import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { agentDb, jobDb, bidDb } from '../db';
import { Job, Bid } from '../models/job';
import {
  validateBid,
  validateAssign,
  validateSubmit,
  validateApprove,
  validateReject,
} from '../services/jobEngine';
import { createEscrow, releaseEscrowToWorker, splitEscrow } from '../services/escrow';
import { submitJobAttestation } from '../services/hedera';
import { leaveReview } from '../services/reputation';
import { broadcastEvent } from './events';

const router = Router();

// Helper — Express 5 types params as string | string[]
const p = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);
const q = (v: unknown): string => String(v ?? '');

/**
 * POST /jobs
 * Create a new job. Validates poster exists and has sufficient balance.
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { poster_id, title, description, required_skill, bounty, deadline_hours } = req.body;

    if (!poster_id || !title || !required_skill || !bounty) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const poster = agentDb.getById(poster_id);
    if (!poster) return res.status(404).json({ error: 'Poster not found' });
    if (poster.tokenBalance < bounty) {
      return res.status(400).json({ error: `Insufficient balance: ${poster.tokenBalance} < ${bounty}` });
    }

    const jobId = `job-${uuid().slice(0, 8)}`;
    const now = new Date();
    const deadline = new Date(now.getTime() + (deadline_hours || 4) * 60 * 60 * 1000);

    const job: Omit<Job, 'bids' | 'expenses'> = {
      id: jobId,
      title,
      description: description || title,
      requiredSkill: required_skill,
      posterId: poster_id,
      bounty,
      status: 'open',
      totalExpenses: '0',
      createdAt: now.toISOString(),
      deadline: deadline.toISOString(),
    };

    jobDb.create(job);

    broadcastEvent({
      agentId: poster_id,
      agentName: poster.name,
      action: 'posted_job',
      detail: `${poster.name} posted "${title}" for ${bounty} WORK`,
      jobId,
    });

    res.status(201).json({ ...job, bids: [], expenses: [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /jobs
 * List jobs with optional filters: ?status=open&skill=Python&min_bounty=50
 */
router.get('/', (req: Request, res: Response) => {
  let jobs = jobDb.getAll();

  if (q(req.query.status)) {
    jobs = jobs.filter((j) => j.status === q(req.query.status));
  }
  if (req.query.skill) {
    jobs = jobs.filter((j) => j.requiredSkill.toLowerCase().includes((req.query.skill as string).toLowerCase()));
  }
  if (req.query.min_bounty) {
    const min = parseInt(req.query.min_bounty as string, 10);
    jobs = jobs.filter((j) => j.bounty >= min);
  }

  res.json(jobs);
});

/**
 * GET /jobs/:id
 * Get a single job by ID.
 */
router.get('/:id', (req: Request, res: Response) => {
  const job = jobDb.getById(p(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

/**
 * POST /jobs/:id/bid
 * Place a bid on an open job.
 */
router.post('/:id/bid', (req: Request, res: Response) => {
  try {
    const { agent_id, amount, message } = req.body;

    if (!agent_id || amount == null) {
      return res.status(400).json({ error: 'Missing required fields: agent_id, amount' });
    }

    const job = jobDb.getById(p(req.params.id));
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const agent = agentDb.getById(agent_id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const error = validateBid(job, agent_id);
    if (error) return res.status(400).json({ error });

    const bid: Bid = {
      agentId: agent_id,
      amount,
      message: message || '',
      reputation: agent.reputationScore,
      createdAt: new Date().toISOString(),
    };

    bidDb.create(p(req.params.id), bid);
    agentDb.updateStatus(agent_id, 'bidding');

    broadcastEvent({
      agentId: agent_id,
      agentName: agent.name,
      action: 'placed_bid',
      detail: `${agent.name} bid ${amount} WORK on "${job.title}"`,
      jobId: job.id,
    });

    res.status(201).json(bid);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /jobs/:id/assign
 * Poster picks a winner. Triggers HTS escrow + HCS attestation.
 */
router.post('/:id/assign', async (req: Request, res: Response) => {
  try {
    const { poster_id, assignee_id } = req.body;

    if (!poster_id || !assignee_id) {
      return res.status(400).json({ error: 'Missing required fields: poster_id, assignee_id' });
    }

    const job = jobDb.getById(p(req.params.id));
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const error = validateAssign(job, poster_id, assignee_id);
    if (error) return res.status(400).json({ error });

    const worker = agentDb.getById(assignee_id)!;

    // Look up the winning bid's amount — that's the agreed price
    const winningBid = job.bids.find((b) => b.agentId === assignee_id);
    const agreedAmount = winningBid ? winningBid.amount : job.bounty;

    // Escrow the agreed bid amount (not the full bounty)
    let txHash: string | undefined;
    try {
      txHash = await createEscrow(poster_id, agreedAmount);
    } catch (err: any) {
      console.error('Escrow failed:', err.message);
      // Continue without on-chain escrow for demo resilience
    }

    // Update job
    jobDb.assign(p(req.params.id), assignee_id);
    if (txHash) jobDb.setTxHash(p(req.params.id), txHash);

    // Immediately transition to in_progress
    jobDb.updateStatus(p(req.params.id), 'in_progress');

    agentDb.updateStatus(poster_id, 'idle');
    agentDb.updateStatus(assignee_id, 'working');

    // Reset losing bidders back to idle
    for (const bid of job.bids) {
      if (bid.agentId !== assignee_id) {
        agentDb.updateStatus(bid.agentId, 'idle');
      }
    }

    // HCS attestation
    let seqNum: number | undefined;
    try {
      seqNum = await submitJobAttestation({
        type: 'job_assigned',
        job_id: job.id,
        poster: poster_id,
        worker: assignee_id,
        bounty: agreedAmount,
        timestamp: new Date().toISOString(),
      });
      if (seqNum) jobDb.setHcsSequenceNumber(p(req.params.id), seqNum);
    } catch (err: any) {
      console.error('HCS attestation failed:', err.message);
    }

    broadcastEvent({
      agentId: assignee_id,
      agentName: worker.name,
      action: 'assigned_job',
      detail: `${worker.name} assigned to "${job.title}" (${agreedAmount} WORK escrowed)`,
      jobId: job.id,
      txHash,
      hcsSequenceNumber: seqNum,
    });

    res.json({ status: 'assigned', assignee_id, agreed_amount: agreedAmount, tx_hash: txHash, hcs_sequence: seqNum });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /jobs/:id/submit
 * Worker submits completed work.
 */
router.post('/:id/submit', (req: Request, res: Response) => {
  try {
    const { agent_id, submission_url, notes } = req.body;

    if (!agent_id) {
      return res.status(400).json({ error: 'Missing required field: agent_id' });
    }

    const job = jobDb.getById(p(req.params.id));
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const error = validateSubmit(job, agent_id);
    if (error) return res.status(400).json({ error });

    const agent = agentDb.getById(agent_id)!;

    jobDb.submit(p(req.params.id), submission_url || notes || 'completed');
    agentDb.updateStatus(agent_id, 'idle');

    broadcastEvent({
      agentId: agent_id,
      agentName: agent.name,
      action: 'submitted_work',
      detail: `${agent.name} submitted work for "${job.title}"`,
      jobId: job.id,
    });

    res.json({ status: 'submitted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /jobs/:id/approve
 * Poster approves work. Triggers HTS release + HCS attestation + reputation.
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { poster_id, rating, review } = req.body;

    if (!poster_id || rating == null) {
      return res.status(400).json({ error: 'Missing required fields: poster_id, rating' });
    }

    const job = jobDb.getById(p(req.params.id));
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const error = validateApprove(job, poster_id);
    if (error) return res.status(400).json({ error });

    const poster = agentDb.getById(poster_id)!;
    const worker = agentDb.getById(job.assigneeId!)!;

    // Look up the winning bid's amount — same as what was escrowed
    const winningBid = job.bids.find((b) => b.agentId === job.assigneeId);
    const agreedAmount = winningBid ? winningBid.amount : job.bounty;

    // Release escrow to worker
    let txHash: string | undefined;
    try {
      txHash = await releaseEscrowToWorker(job.assigneeId!, agreedAmount);
    } catch (err: any) {
      console.error('Release escrow failed:', err.message);
      // Update balance locally anyway for demo
      agentDb.updateBalance(job.assigneeId!, worker.tokenBalance + agreedAmount);
    }

    // Update job
    jobDb.updateStatus(p(req.params.id), 'completed');
    if (txHash) jobDb.setTxHash(p(req.params.id), txHash);

    // Increment completed jobs
    agentDb.incrementCompleted(job.assigneeId!);

    // HCS job completion attestation
    let jobSeqNum: number | undefined;
    try {
      jobSeqNum = await submitJobAttestation({
        type: 'job_completion',
        job_id: job.id,
        poster: poster_id,
        worker: job.assigneeId!,
        bounty: agreedAmount,
        rating,
        payment_tx: txHash,
        timestamp: new Date().toISOString(),
      });
      if (jobSeqNum) jobDb.setHcsSequenceNumber(p(req.params.id), jobSeqNum);
    } catch (err: any) {
      console.error('HCS job attestation failed:', err.message);
    }

    // HCS reputation feedback
    let repSeqNum: number | undefined;
    try {
      // Convert 1-5 rating to 0-100 score
      const score = Math.round((rating / 5) * 100);
      repSeqNum = await leaveReview(
        job.assigneeId!,
        poster_id,
        score,
        [job.requiredSkill],
        review || 'Good work',
        job.id
      );
    } catch (err: any) {
      console.error('Reputation feedback failed:', err.message);
    }

    broadcastEvent({
      agentId: poster_id,
      agentName: poster.name,
      action: 'approved_work',
      detail: `${poster.name} approved "${job.title}" — ${agreedAmount} WORK released to ${worker.name}`,
      jobId: job.id,
      txHash,
      hcsSequenceNumber: jobSeqNum,
    });

    broadcastEvent({
      agentId: job.assigneeId!,
      agentName: worker.name,
      action: 'earned_tokens',
      detail: `${worker.name} earned ${agreedAmount} WORK for "${job.title}"`,
      jobId: job.id,
      txHash,
    });

    if (repSeqNum) {
      broadcastEvent({
        agentId: poster_id,
        agentName: poster.name,
        action: 'left_review',
        detail: `${poster.name} rated ${worker.name} ${rating}/5 for "${job.title}"`,
        jobId: job.id,
        hcsSequenceNumber: repSeqNum,
      });
    }

    res.json({
      status: 'completed',
      payment_tx: txHash,
      hcs_job_sequence: jobSeqNum,
      hcs_reputation_sequence: repSeqNum,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Helper: check if a submitted job has passed the auto-release window (2 hours).
 * If so, release full escrow to worker and mark completed.
 * Returns true if auto-released (caller should return early).
 */
async function checkAutoRelease(job: Job, res: Response): Promise<boolean> {
  if (job.status !== 'submitted') return false;

  if (Date.now() > new Date(job.deadline).getTime()) {
    const worker = agentDb.getById(job.assigneeId!)!;
    const winningBid = job.bids.find((b) => b.agentId === job.assigneeId);
    const agreedAmount = winningBid ? winningBid.amount : job.bounty;

    // Auto-release full escrow to worker
    let txHash: string | undefined;
    try {
      txHash = await releaseEscrowToWorker(job.assigneeId!, agreedAmount);
    } catch (err: any) {
      console.error('Auto-release failed:', err.message);
      agentDb.updateBalance(job.assigneeId!, worker.tokenBalance + agreedAmount);
    }

    jobDb.updateStatus(job.id, 'completed');
    agentDb.incrementCompleted(job.assigneeId!);

    broadcastEvent({
      agentId: job.assigneeId!,
      agentName: worker.name,
      action: 'auto_released',
      detail: `"${job.title}" auto-completed — ${agreedAmount} WORK released to ${worker.name} (poster did not respond)`,
      jobId: job.id,
      txHash,
    });

    res.json({
      status: 'auto_completed',
      message: 'Poster did not respond before deadline — escrow auto-released to worker',
      payment_tx: txHash,
    });
    return true;
  }

  return false;
}

/**
 * POST /jobs/:id/reject
 * Poster rejects submitted work. Escrow splits 70/30 (poster/worker).
 * Poster takes a reputation penalty. Recorded on HCS.
 */
router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { poster_id, reason } = req.body;

    if (!poster_id) {
      return res.status(400).json({ error: 'Missing required field: poster_id' });
    }

    const job = jobDb.getById(p(req.params.id));
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const error = validateReject(job, poster_id);
    if (error) return res.status(400).json({ error });

    // Check auto-release — if deadline passed, release to worker instead
    if (await checkAutoRelease(job, res)) return;

    const poster = agentDb.getById(poster_id)!;
    const worker = agentDb.getById(job.assigneeId!)!;

    // Look up the winning bid amount
    const winningBid = job.bids.find((b) => b.agentId === job.assigneeId);
    const agreedAmount = winningBid ? winningBid.amount : job.bounty;

    // Split escrow: 30% kill fee to worker, 70% refund to poster
    let splitResult;
    try {
      splitResult = await splitEscrow(poster_id, job.assigneeId!, agreedAmount, 0.3);
    } catch (err: any) {
      console.error('Split escrow failed:', err.message);
      // Fallback: do local balance updates
      const workerAmount = Math.round(agreedAmount * 0.3);
      const posterAmount = agreedAmount - workerAmount;
      agentDb.updateBalance(job.assigneeId!, worker.tokenBalance + workerAmount);
      agentDb.updateBalance(poster_id, poster.tokenBalance + posterAmount);
      splitResult = { workerTxHash: '', posterTxHash: '', workerAmount, posterAmount };
    }

    // Update job status
    jobDb.updateStatus(p(req.params.id), 'rejected');

    // Reset agent statuses
    agentDb.updateStatus(poster_id, 'idle');
    agentDb.updateStatus(job.assigneeId!, 'idle');

    // Poster reputation penalty: -10 points
    const newPosterRep = Math.max(0, poster.reputationScore - 10);
    agentDb.updateReputation(poster_id, newPosterRep);

    // HCS attestation
    let seqNum: number | undefined;
    try {
      seqNum = await submitJobAttestation({
        type: 'job_rejected',
        job_id: job.id,
        poster: poster_id,
        worker: job.assigneeId!,
        bounty: agreedAmount,
        timestamp: new Date().toISOString(),
      });
      if (seqNum) jobDb.setHcsSequenceNumber(p(req.params.id), seqNum);
    } catch (err: any) {
      console.error('HCS rejection attestation failed:', err.message);
    }

    // Broadcast events
    broadcastEvent({
      agentId: poster_id,
      agentName: poster.name,
      action: 'rejected_work',
      detail: `${poster.name} rejected "${job.title}" — ${splitResult.posterAmount} WORK refunded, ${splitResult.workerAmount} WORK kill fee to ${worker.name}`,
      jobId: job.id,
      txHash: splitResult.posterTxHash,
      hcsSequenceNumber: seqNum,
    });

    broadcastEvent({
      agentId: job.assigneeId!,
      agentName: worker.name,
      action: 'earned_tokens',
      detail: `${worker.name} received ${splitResult.workerAmount} WORK kill fee for "${job.title}"`,
      jobId: job.id,
      txHash: splitResult.workerTxHash,
    });

    res.json({
      status: 'rejected',
      reason: reason || 'No reason provided',
      split: {
        worker_kill_fee: splitResult.workerAmount,
        poster_refund: splitResult.posterAmount,
        worker_tx: splitResult.workerTxHash,
        poster_tx: splitResult.posterTxHash,
      },
      poster_reputation: newPosterRep,
      hcs_sequence: seqNum,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as jobRoutes };
