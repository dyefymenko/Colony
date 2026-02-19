import { agentDb } from '../db';
import { escrowTokens, releaseEscrow } from './hedera';

/**
 * Escrow service — manages WORK token locking during job lifecycle.
 *
 * On assign: poster's tokens → operator treasury (escrow)
 * On approve: operator treasury → worker (release)
 */

export async function createEscrow(
  posterId: string,
  bounty: number
): Promise<string> {
  const poster = agentDb.getById(posterId);
  if (!poster) throw new Error(`Poster ${posterId} not found`);
  if (poster.tokenBalance < bounty) {
    throw new Error(`Insufficient balance: ${poster.tokenBalance} < ${bounty}`);
  }

  // Transfer on Hedera
  const txHash = await escrowTokens(poster.hederaAccountId, bounty);

  // Update local balance
  agentDb.updateBalance(posterId, poster.tokenBalance - bounty);

  return txHash;
}

export async function releaseEscrowToWorker(
  workerId: string,
  bounty: number
): Promise<string> {
  const worker = agentDb.getById(workerId);
  if (!worker) throw new Error(`Worker ${workerId} not found`);

  // Transfer on Hedera
  const txHash = await releaseEscrow(worker.hederaAccountId, bounty);

  // Update local balance
  agentDb.updateBalance(workerId, worker.tokenBalance + bounty);

  return txHash;
}

/**
 * Split escrow on rejection: worker gets a kill fee, poster gets the rest back.
 * Returns tx hashes for both transfers.
 */
export async function splitEscrow(
  posterId: string,
  workerId: string,
  totalAmount: number,
  workerPercent: number = 0.3
): Promise<{ workerTxHash: string; posterTxHash: string; workerAmount: number; posterAmount: number }> {
  const poster = agentDb.getById(posterId);
  if (!poster) throw new Error(`Poster ${posterId} not found`);
  const worker = agentDb.getById(workerId);
  if (!worker) throw new Error(`Worker ${workerId} not found`);

  const workerAmount = Math.round(totalAmount * workerPercent);
  const posterAmount = totalAmount - workerAmount;

  // Release kill fee to worker
  let workerTxHash = '';
  try {
    workerTxHash = await releaseEscrow(worker.hederaAccountId, workerAmount);
  } catch (err: any) {
    console.error('Kill fee transfer failed:', err.message);
  }
  agentDb.updateBalance(workerId, worker.tokenBalance + workerAmount);

  // Refund remainder to poster
  let posterTxHash = '';
  try {
    posterTxHash = await releaseEscrow(poster.hederaAccountId, posterAmount);
  } catch (err: any) {
    console.error('Poster refund transfer failed:', err.message);
  }
  agentDb.updateBalance(posterId, poster.tokenBalance + posterAmount);

  return { workerTxHash, posterTxHash, workerAmount, posterAmount };
}
