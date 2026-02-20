import { Router, Request, Response } from 'express';
import { agentDb, jobDb, expenseDb } from '../db';
import { broadcastEvent } from './events';
import { KitePaymentService } from '../services/kite';
import { loadWalletState, getKiteBalance, kiteExplorerAddressUrl } from '../services/kiteWallet';
import { BasePaymentService } from '../services/basePayment';
import { loadBaseWalletState, getBaseBalance, baseExplorerAddressUrl } from '../services/baseWallet';

const router = Router();
const kiteService = new KitePaymentService();
const baseService = new BasePaymentService();

/**
 * Shared handler for x402 requests on either chain.
 */
async function handleX402Request(req: Request, res: Response, chain: 'kite' | 'base') {
  try {
    const { agent_id, job_id, url, method, body: requestBody } = req.body;

    if (!agent_id || !job_id || !url) {
      return res.status(400).json({ error: 'Missing required fields: agent_id, job_id, url' });
    }

    const agent = agentDb.getById(agent_id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const job = jobDb.getById(job_id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const useBase = chain === 'base';
    const tokenLabel = useBase ? 'ETH (Base)' : 'KITE';
    const networkId = useBase ? 'eip155:84532' : 'eip155:2368';

    // Execute request through x402 payment client
    let amountPaid: string;
    let txHash: string;
    let txUrl: string;
    let service: string;
    let responseData: any;

    try {
      if (useBase) {
        const result = await baseService.requestWithPayment(url, agent.name, {
          method: method || 'GET',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody ? JSON.stringify(requestBody) : undefined,
        });
        amountPaid = result.amountPaid;
        txHash = result.txHash;
        txUrl = result.baseTxUrl;
        service = result.service;
        responseData = result.response;
      } else {
        const result = await kiteService.requestWithPayment(url, agent.name, {
          method: method || 'GET',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody ? JSON.stringify(requestBody) : undefined,
        });
        amountPaid = result.amountPaid;
        txHash = result.txHash;
        txUrl = result.kiteTxUrl;
        service = result.service;
        responseData = result.response;
      }
    } catch (err: any) {
      // Graceful failure for insufficient funds / spending limits
      const msg = err.message || '';
      if (msg.includes('Insufficient') || msg.includes('spending limit')) {
        return res.status(402).json({
          error: 'x402_payment_failed',
          message: msg,
          agent_id,
          chain,
          suggestion: msg.includes('faucet')
            ? `Fund the agent wallet via the ${useBase ? 'Base Sepolia' : 'Kite'} faucet`
            : 'Reduce payment amount or increase spending limit',
        });
      }
      if (msg.includes('No Kite wallet') || msg.includes('No Base wallet')) {
        return res.status(503).json({
          error: 'wallet_not_configured',
          message: msg,
          chain,
          suggestion: `Run the ${useBase ? 'Base' : 'Kite'} wallet setup script first`,
        });
      }
      throw err;
    }

    // Log expense if payment was made
    if (amountPaid !== '0') {
      const hostname = new URL(url).hostname;
      const expense = {
        agentId: agent_id,
        service: hostname,
        amount: `${amountPaid} ${tokenLabel}`,
        kiteTxHash: txHash,
        timestamp: new Date().toISOString(),
        chain: chain as 'kite' | 'base',
      };

      expenseDb.create(job_id, expense);

      // Update job total expenses
      const currentExpenses = parseFloat(job.totalExpenses || '0');
      const newTotal = (currentExpenses + parseFloat(amountPaid)).toFixed(4);
      jobDb.updateExpenseTotal(job_id, newTotal);

      broadcastEvent({
        agentId: agent_id,
        agentName: agent.name,
        action: 'x402_payment',
        detail: `${agent.name} paid ${amountPaid} ${tokenLabel} to ${hostname} via x402`,
        jobId: job_id,
        kiteTxHash: txHash,
        chain: chain as 'kite' | 'base',
      });
    }

    res.json({
      result: responseData,
      payment: {
        amount: `${amountPaid} ${tokenLabel}`,
        tx_hash: txHash,
        tx_url: txUrl,
        service,
        chain,
        network: networkId,
      },
    });
  } catch (err: any) {
    console.error('x402 proxy error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /services/x402-request
 * Agent requests an external paid service. Server handles x402 payment via Kite or Base,
 * logs expense to job.
 *
 * Body: { agent_id, job_id, url, method?, body?, chain?: "kite" | "base" }
 */
router.post('/x402-request', async (req: Request, res: Response) => {
  const chain = (req.body.chain === 'base') ? 'base' : 'kite';
  return handleX402Request(req, res, chain);
});

/**
 * POST /services/x402-request-base
 * Shorthand that always uses Base chain for x402 payment.
 */
router.post('/x402-request-base', async (req: Request, res: Response) => {
  return handleX402Request(req, res, 'base');
});

/**
 * GET /services/x402-spending/:agent_id
 * Get spending summary for an agent.
 */
router.get('/x402-spending/:agent_id', (req: Request, res: Response) => {
  const agentId = req.params.agent_id as string;
  const agent = agentDb.getById(agentId);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const kiteSpending = kiteService.getAgentSpending(agent.name);
  const baseSpending = baseService.getAgentSpending(agent.name);
  res.json({
    agent_id: agentId,
    agent_name: agent.name,
    kite: kiteSpending,
    base: baseSpending,
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

/**
 * GET /services/base-wallets
 * List all agent Base Sepolia wallet addresses (public info only, no keys).
 */
router.get('/base-wallets', async (_req: Request, res: Response) => {
  const state = loadBaseWalletState();
  if (!state) {
    return res.status(503).json({
      error: 'No Base wallets configured',
      suggestion: 'Run: npx tsx src/scripts/setup-base-wallets.ts',
    });
  }

  const wallets = [];
  for (const [name, wallet] of Object.entries(state.agents)) {
    let balance = '0';
    try {
      balance = await getBaseBalance(wallet.address);
    } catch {}

    wallets.push({
      name,
      address: wallet.address,
      balance: `${balance} ETH`,
      explorer: baseExplorerAddressUrl(wallet.address),
    });
  }

  wallets.push({
    name: 'operator',
    address: state.operator.address,
    balance: '', // don't expose operator balance
    explorer: baseExplorerAddressUrl(state.operator.address),
  });

  res.json({ network: 'base-sepolia', chain_id: 84532, wallets });
});

export { router as serviceRoutes };
