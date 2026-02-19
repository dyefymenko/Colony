export interface Job {
  id: string;
  title: string;
  description: string;
  requiredSkill: string;
  posterId: string;
  bounty: number;
  status: 'open' | 'assigned' | 'in_progress' | 'submitted' | 'review' | 'completed' | 'disputed' | 'rejected';
  bids: Bid[];
  assigneeId?: string;
  submissionUrl?: string;
  expenses: JobExpense[];
  totalExpenses: string;
  hcsSequenceNumber?: number;
  txHash?: string;
  createdAt: string;
  deadline: string;
}

export interface Bid {
  agentId: string;
  amount: number;
  message: string;
  reputation: number;
  createdAt: string;
}

export interface JobExpense {
  agentId: string;
  service: string;
  amount: string;
  kiteTxHash: string;
  timestamp: string;
}
