import { Job } from '../models/job';

/**
 * Job lifecycle state machine.
 * Validates transitions and enforces business rules.
 *
 * Valid transitions:
 *   open → assigned       (poster picks winner, escrow created)
 *   assigned → in_progress (automatic after assignment)
 *   in_progress → submitted (worker submits deliverable)
 *   submitted → completed  (poster approves, payment released)
 *   submitted → disputed   (poster rejects)
 *   submitted → rejected   (poster rejects, escrow split 70/30)
 */

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['assigned'],
  assigned: ['in_progress'],
  in_progress: ['submitted'],
  submitted: ['completed', 'disputed', 'rejected'],
  disputed: ['open'], // re-open disputed jobs
};

export function canTransition(currentStatus: string, newStatus: string): boolean {
  const valid = VALID_TRANSITIONS[currentStatus];
  return valid ? valid.includes(newStatus) : false;
}

export function validateBid(job: Job, agentId: string): string | null {
  if (job.status !== 'open') {
    return `Cannot bid on job with status "${job.status}"`;
  }
  if (job.posterId === agentId) {
    return 'Cannot bid on your own job';
  }
  if (job.bids.some((b) => b.agentId === agentId)) {
    return 'Already bid on this job';
  }
  return null;
}

export function validateAssign(job: Job, posterId: string, assigneeId: string): string | null {
  if (job.status !== 'open') {
    return `Cannot assign job with status "${job.status}"`;
  }
  if (job.posterId !== posterId) {
    return 'Only the poster can assign this job';
  }
  if (!job.bids.some((b) => b.agentId === assigneeId)) {
    return 'Assignee did not bid on this job';
  }
  return null;
}

export function validateSubmit(job: Job, agentId: string): string | null {
  if (job.status !== 'in_progress') {
    return `Cannot submit work for job with status "${job.status}"`;
  }
  if (job.assigneeId !== agentId) {
    return 'Only the assigned worker can submit';
  }
  return null;
}

export function validateApprove(job: Job, posterId: string): string | null {
  if (job.status !== 'submitted') {
    return `Cannot approve job with status "${job.status}"`;
  }
  if (job.posterId !== posterId) {
    return 'Only the poster can approve';
  }
  return null;
}

export function validateReject(job: Job, posterId: string): string | null {
  if (job.status !== 'submitted') {
    return `Cannot reject job with status "${job.status}"`;
  }
  if (job.posterId !== posterId) {
    return 'Only the poster can reject';
  }
  return null;
}

export function isDeadlinePassed(job: Job): boolean {
  return new Date(job.deadline) < new Date();
}
