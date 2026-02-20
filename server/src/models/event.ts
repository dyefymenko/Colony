export interface AgentEvent {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  action:
    | 'posted_job'
    | 'placed_bid'
    | 'assigned_job'
    | 'submitted_work'
    | 'approved_work'
    | 'left_review'
    | 'earned_tokens'
    | 'staked_tokens'
    | 'x402_payment'
    | 'rejected_work'
    | 'auto_released';
  detail: string;
  jobId?: string;
  txHash?: string;
  kiteTxHash?: string;
  hcsSequenceNumber?: number;
  chain?: 'kite' | 'base';
}
