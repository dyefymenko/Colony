import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { agentDb } from '../db';
import { Agent } from '../models/agent';
import {
  associateAgentWithTokens,
  distributeTokens,
  mintIdentityNft,
} from '../services/hedera';
import { getAgentReputation } from '../services/reputation';
import { loadWalletState, kiteExplorerAddressUrl } from '../services/kiteWallet';
import { loadBaseWalletState, baseExplorerAddressUrl } from '../services/baseWallet';
import { broadcastEvent } from './events';
import { config } from '../config';

const router = Router();

// Map agent name to its config key for looking up Hedera keys
const AGENT_KEY_MAP: Record<string, string> = {
  codex: 'codex',
  sentry: 'sentry',
  scraper: 'scraper',
  quill: 'quill',
  argus: 'argus',
};

/**
 * POST /agents/register
 * Register a new agent: associate tokens, mint identity NFT, distribute WORK tokens.
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, role, skills, hedera_account_id } = req.body;

    if (!name || !role || !skills || !hedera_account_id) {
      return res.status(400).json({ error: 'Missing required fields: name, role, skills, hedera_account_id' });
    }

    // Look up private key for this agent
    const agentKeyName = AGENT_KEY_MAP[name.toLowerCase()];
    const agentKeyConfig = agentKeyName ? (config.agents as any)[agentKeyName] : null;
    const agentPrivateKey = agentKeyConfig?.key;

    const agentId = `agent-${uuid().slice(0, 8)}`;
    const now = new Date().toISOString();

    let identityNftSerial = 0;
    let txHash: string | undefined;

    // Hedera operations (skip if no private key configured)
    if (agentPrivateKey) {
      try {
        // 1. Associate agent with WORK + AGID tokens
        await associateAgentWithTokens(hedera_account_id, agentPrivateKey);

        // 2. Mint identity NFT
        identityNftSerial = await mintIdentityNft({
          name,
          role,
          skills,
          registered: now,
        });

        // 3. Distribute 500 WORK tokens
        txHash = await distributeTokens(hedera_account_id, 500);
      } catch (err: any) {
        console.error(`Hedera operations failed for ${name}:`, err.message);
        // Continue with registration even if Hedera fails
      }
    } else {
      console.log(`No private key configured for agent "${name}", skipping Hedera operations`);
    }

    // Look up Kite wallet for this agent
    let kiteAgentPassportId: string | undefined;
    const kiteState = loadWalletState();
    if (kiteState) {
      const kiteWallet = kiteState.agents[name.toLowerCase()];
      if (kiteWallet) {
        kiteAgentPassportId = kiteWallet.address;
        // Link agent ID to wallet for x402 lookups
        kiteWallet.agentId = agentId;
      }
    }

    // Look up Base Sepolia wallet for this agent
    let baseWalletAddress: string | undefined;
    const baseState = loadBaseWalletState();
    if (baseState) {
      const baseWallet = baseState.agents[name.toLowerCase()];
      if (baseWallet) {
        baseWalletAddress = baseWallet.address;
        // Link agent ID to wallet for x402 lookups
        baseWallet.agentId = agentId;
      }
    }

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
      kite_explorer: kiteAgentPassportId ? kiteExplorerAddressUrl(kiteAgentPassportId) : null,
      base_wallet: baseWalletAddress || null,
      base_explorer: baseWalletAddress ? baseExplorerAddressUrl(baseWalletAddress) : null,
      token_balance: 500,
      status: 'idle',
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Backfill Base wallet address from base-wallets.json if missing from DB.
 */
function enrichWithBaseWallet(agent: Agent): Agent {
  if (agent.baseWalletAddress) return agent;
  const baseState = loadBaseWalletState();
  if (!baseState) return agent;
  const baseWallet = baseState.agents[agent.name.toLowerCase()];
  if (!baseWallet) return agent;
  // Persist so future reads don't need the lookup
  agentDb.updateBaseWallet(agent.id, baseWallet.address);
  return { ...agent, baseWalletAddress: baseWallet.address };
}

/**
 * GET /agents
 * List all registered agents.
 */
router.get('/', (_req: Request, res: Response) => {
  const agents = agentDb.getAll().map(enrichWithBaseWallet);
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
  res.json(enrichWithBaseWallet(agent));
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
