import { useState, useEffect, useRef, useCallback } from 'react';

export interface AgentEvent {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  action: string;
  detail: string;
  jobId?: string;
  txHash?: string;
  kiteTxHash?: string;
  hcsSequenceNumber?: number;
  chain?: 'kite' | 'base';
}

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
  baseWalletAddress?: string;
  status: string;
  registeredAt: string;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  requiredSkill: string;
  posterId: string;
  bounty: number;
  status: string;
  bids: { agentId: string; amount: number; message: string; reputation: number; createdAt: string }[];
  assigneeId?: string;
  submissionUrl?: string;
  expenses: { agentId: string; service: string; amount: string; kiteTxHash: string; timestamp: string; chain?: 'kite' | 'base' }[];
  totalExpenses: string;
  hcsSequenceNumber?: number;
  txHash?: string;
  createdAt: string;
  deadline: string;
}

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

export function useEventStream() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const [agentsRes, jobsRes] = await Promise.all([
        fetch(`${API_BASE}/agents`),
        fetch(`${API_BASE}/jobs`),
      ]);
      setAgents(await agentsRes.json());
      setJobs(await jobsRes.json());
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  }, []);

  useEffect(() => {
    // Initial data load
    refreshData();

    // SSE connection
    const es = new EventSource(`${API_BASE}/events`);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      try {
        const event: AgentEvent = JSON.parse(e.data);
        setEvents((prev) => [event, ...prev].slice(0, 200));
        // Refresh data on every event to keep state in sync
        refreshData();
      } catch {
        // ignore malformed
      }
    };

    return () => {
      es.close();
    };
  }, [refreshData]);

  return { events, agents, jobs, connected, refreshData };
}
