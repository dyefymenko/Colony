export interface Agent {
  id: string;
  name: string;
  role: string;
  skills: string[];
  hederaAccountId: string;
  identityNftSerial: number;
  tokenBalance: number;
  stakedTokens: number;
  reputationScore: number;
  completedJobs: number;
  kiteAgentPassportId?: string;
  kiteUsdcBalance?: string;
  status: 'idle' | 'working' | 'bidding' | 'posting';
  registeredAt: string;
}
