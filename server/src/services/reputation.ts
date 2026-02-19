import { agentDb } from '../db';
import { submitReputationFeedback, getReputationScores } from './hedera';

export async function leaveReview(
  agentId: string,
  reviewerId: string,
  score: number,
  tags: string[],
  review: string,
  jobId: string
): Promise<number> {
  // Submit to HCS
  const seqNum = await submitReputationFeedback({
    type: 'reputation_feedback',
    agent_id: agentId,
    reviewer_id: reviewerId,
    score,
    tags,
    review,
    job_id: jobId,
  });

  // Update local reputation (simple rolling average approach)
  const agent = agentDb.getById(agentId);
  if (agent) {
    const totalReviews = agent.completedJobs + 1;
    const newScore = Math.round(
      ((agent.reputationScore * agent.completedJobs) + score) / totalReviews
    );
    agentDb.updateReputation(agentId, Math.min(100, Math.max(0, newScore)));
  }

  return seqNum;
}

export async function getAgentReputation(agentId: string) {
  return getReputationScores(agentId);
}
