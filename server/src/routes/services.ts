import { Router, Request, Response } from 'express';
import { agentDb, jobDb, expenseDb } from '../db';
import { broadcastEvent } from './events';
import { KitePaymentService } from '../services/kite';
import { loadWalletState, getKiteBalance, kiteExplorerAddressUrl } from '../services/kiteWallet';

const router = Router();
const kiteService = new KitePaymentService();

/**
 * POST /services/x402-request
 * Agent requests an external paid service. Server handles x402 payment via Kite,
 * logs expense to job.
 */
router.post('/x402-request', async (req: Request, res: Response) => {
  try {
    const { agent_id, job_id, url, method, body: requestBody } = req.body;

    if (!agent_id || !job_id || !url) {
      return res.status(400).json({ error: 'Missing required fields: agent_id, job_id, url' });
    }

    const agent = agentDb.getById(agent_id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const job = jobDb.getById(job_id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Execute request through x402 payment client
    let result;
    try {
      result = await kiteService.requestWithPayment(url, agent.name, {
        method: method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody ? JSON.stringify(requestBody) : undefined,
      });
    } catch (err: any) {
      // Graceful failure for insufficient funds / spending limits
      const msg = err.message || '';
      if (msg.includes('Insufficient KITE') || msg.includes('spending limit')) {
        return res.status(402).json({
          error: 'x402_payment_failed',
          message: msg,
          agent_id,
          suggestion: msg.includes('faucet') ? 'Fund the agent wallet via the Kite faucet' : 'Reduce payment amount or increase spending limit',
        });
      }
      if (msg.includes('No Kite wallet')) {
        return res.status(503).json({
          error: 'wallet_not_configured',
          message: msg,
          suggestion: 'Run the Kite wallet setup script first',
        });
      }
      throw err;
    }

    // Log expense if payment was made
    if (result.amountPaid !== '0') {
      const hostname = new URL(url).hostname;
      const expense = {
        agentId: agent_id,
        service: hostname,
        amount: `${result.amountPaid} KITE`,
        kiteTxHash: result.txHash,
        timestamp: new Date().toISOString(),
      };

      expenseDb.create(job_id, expense);

      // Update job total expenses
      const currentExpenses = parseFloat(job.totalExpenses || '0');
      const newTotal = (currentExpenses + parseFloat(result.amountPaid)).toFixed(4);
      jobDb.updateExpenseTotal(job_id, newTotal);

      broadcastEvent({
        agentId: agent_id,
        agentName: agent.name,
        action: 'x402_payment',
        detail: `${agent.name} paid ${result.amountPaid} KITE to ${hostname} via x402`,
        jobId: job_id,
        kiteTxHash: result.txHash,
      });
    }

    res.json({
      result: result.response,
      payment: {
        amount: `${result.amountPaid} KITE`,
        kite_tx_hash: result.txHash,
        kite_tx_url: result.kiteTxUrl,
        service: result.service,
        network: 'eip155:2368',
      },
    });
  } catch (err: any) {
    console.error('x402 proxy error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /services/x402-spending/:agent_id
 * Get spending summary for an agent.
 */
router.get('/x402-spending/:agent_id', (req: Request, res: Response) => {
  const agentId = req.params.agent_id as string;
  const agent = agentDb.getById(agentId);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const spending = kiteService.getAgentSpending(agent.name);
  res.json({
    agent_id: agentId,
    agent_name: agent.name,
    ...spending,
  });
});

/**
 * GET /services/kite-wallets
 * List all agent Kite wallet addresses (public info only, no keys).
 */
router.get('/kite-wallets', async (_req: Request, res: Response) => {
  const state = loadWalletState();
  if (!state) {
    return res.status(503).json({
      error: 'No Kite wallets configured',
      suggestion: 'Run: npx tsx src/scripts/setup-kite-wallets.ts',
    });
  }

  const wallets = [];
  for (const [name, wallet] of Object.entries(state.agents)) {
    let balance = '0';
    try {
      balance = await getKiteBalance(wallet.address);
    } catch {}

    wallets.push({
      name,
      address: wallet.address,
      balance: `${balance} KITE`,
      explorer: kiteExplorerAddressUrl(wallet.address),
    });
  }

  wallets.push({
    name: 'operator',
    address: state.operator.address,
    balance: '', // don't expose operator balance
    explorer: kiteExplorerAddressUrl(state.operator.address),
  });

  res.json({ network: 'kite-testnet', chain_id: 2368, wallets });
});

export { router as serviceRoutes };
