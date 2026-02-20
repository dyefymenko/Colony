import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { agentDb } from '../db';
import { Agent } from '../models/agent';
import {
  distributeTokens,
  mintIdentityNft,
} from '../services/hedera';
import { getAgentReputation } from '../services/reputation';
import { broadcastEvent } from './events';

const router = Router();

/**
 * POST /agents/register
 * Register a new agent: mint identity NFT, distribute WORK tokens.
 * Agents supply their own wallet addresses; no server-held private keys needed.
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, role, skills, hedera_account_id, kite_wallet_address, base_wallet_address } = req.body;

    if (!name || !role || !skills || !hedera_account_id) {
      return res.status(400).json({ error: 'Missing required fields: name, role, skills, hedera_account_id' });
    }

    const agentId = `agent-${uuid().slice(0, 8)}`;
    const now = new Date().toISOString();

    let identityNftSerial = 0;
    let txHash: string | undefined;

    // Hedera operations — operator-signed, no agent private key needed.
    // distributeTokens will fail gracefully if agent hasn't pre-associated WORK token.
    try {
      identityNftSerial = await mintIdentityNft({
        name,
        role,
        skills,
        registered: now,
      }, hedera_account_id, agentId);

      txHash = await distributeTokens(hedera_account_id, 500);
    } catch (err: any) {
      console.error(`Hedera operations failed for ${name}:`, err.message);
      // Continue with registration even if Hedera fails
    }

    const kiteAgentPassportId: string | undefined = kite_wallet_address || undefined;
    const baseWalletAddress: string | undefined = base_wallet_address || undefined;

    const agent: Agent = {
      id: agentId,
      name,
      role,
      skills,
      hederaAccountId: hedera_account_id,
      identityNftSerial,
      tokenBalance: 500,
      stakedTokens: 0,
      reputationScore: 50,
      completedJobs: 0,
      kiteAgentPassportId,
      baseWalletAddress,
      status: 'idle',
      registeredAt: now,
    };

    agentDb.create(agent);

    broadcastEvent({
      agentId,
      agentName: name,
      action: 'earned_tokens',
      detail: `${name} registered and received 500 WORK tokens`,
      txHash,
    });

    res.status(201).json({
      id: agentId,
      name,
      identity_nft_serial: identityNftSerial,
      kite_wallet: kiteAgentPassportId || null,
      base_wallet: baseWalletAddress || null,
      token_balance: 500,
      status: 'idle',
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /agents
 * List all registered agents.
 */
router.get('/', (_req: Request, res: Response) => {
  const agents = agentDb.getAll();
  res.json(agents);
});

/**
 * GET /agents/:id
 * Get a single agent by ID.
 */
router.get('/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const agent = agentDb.getById(id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
});

/**
 * GET /agents/:id/reputation
 * Get agent reputation from HCS mirror node.
 */
router.get('/:id/reputation', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const agent = agentDb.getById(id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const reputation = await getAgentReputation(id);
    res.json({
      agent_id: id,
      agent_name: agent.name,
      ...reputation,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as agentRoutes };
