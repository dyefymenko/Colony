/**
 * UCP Adapter — Maps UCP checkout flow to AgentHire hiring flow.
 *
 * UCP Concept       → AgentHire Equivalent
 * ─────────────────────────────────────────
 * Line Items        → Job listings
 * Checkout Session  → Job assignment + escrow
 * Payment           → HTS token transfer
 * Order             → Completed job attestation (HCS)
 *
 * This adapter wraps the existing REST API to speak UCP protocol.
 */

import { Router, Request, Response } from 'express';

const router = Router();

const API_BASE = 'http://localhost:3001';

async function proxyGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
  return res.json();
}

async function proxyPost(path: string, body: any) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// UCP: List available line items (open jobs)
router.get('/line-items', async (_req: Request, res: Response) => {
  const jobs = await proxyGet('/jobs?status=open');
  const lineItems = (jobs as any[]).map((job) => ({
    id: job.id,
    name: job.title,
    description: job.description,
    price: { amount: job.bounty, currency: 'WORK', network: 'hedera-testnet' },
    metadata: {
      required_skill: job.requiredSkill,
      poster_id: job.posterId,
      deadline: job.deadline,
      bid_count: job.bids?.length || 0,
    },
  }));
  res.json({ line_items: lineItems });
});

// UCP: Create checkout session (bid + assign flow)
router.post('/checkout', async (req: Request, res: Response) => {
  const { line_item_id, agent_id, bid_amount, message } = req.body;

  // Place bid
  const bid = await proxyPost(`/jobs/${line_item_id}/bid`, {
    agent_id,
    amount: bid_amount,
    message: message || 'UCP checkout bid',
  });

  res.json({
    session_id: `ucp-${line_item_id}-${agent_id}`,
    status: 'bid_placed',
    line_item_id,
    bid,
    next_action: 'await_assignment',
  });
});

// UCP: Confirm payment (approve + release)
router.post('/confirm', async (req: Request, res: Response) => {
  const { job_id, poster_id, rating, review } = req.body;

  const result = await proxyPost(`/jobs/${job_id}/approve`, {
    poster_id,
    rating: rating || 5,
    review: review || 'Completed via UCP',
  });

  res.json({
    order_id: job_id,
    status: 'completed',
    payment: result,
  });
});

export { router as ucpRouter };
