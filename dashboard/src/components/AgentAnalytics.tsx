import { useState, useMemo } from 'react';
import { Agent, AgentEvent } from '../hooks/useEventStream';

interface BarEntry {
  name: string;
  value: number;
}

const TOP_N = 5;

function MiniBarChart({
  title,
  data,
  color,
  format,
}: {
  title: string;
  data: BarEntry[];
  color: string;
  format?: (v: number) => string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (data.length === 0) {
    return (
      <div className="mini-chart">
        <div className="mini-chart-title">{title}</div>
        <div className="mini-chart-empty">No data yet</div>
      </div>
    );
  }

  const truncated = !expanded && data.length > TOP_N;
  const visible = truncated ? data.slice(0, TOP_N) : data;
  const max = Math.max(...data.map((d) => d.value), 1);
  const fmt = format || ((v: number) => String(v));

  return (
    <div className="mini-chart">
      <div className="mini-chart-title">{title}</div>
      {visible.map((d, i) => (
        <div key={d.name} className="mini-chart-bar">
          <span className="mini-chart-rank">{i + 1}</span>
          <span className="mini-chart-label">{d.name}</span>
          <div className="mini-chart-track">
            <div
              className="mini-chart-fill"
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: color,
              }}
            />
          </div>
          <span className="mini-chart-value">{fmt(d.value)}</span>
        </div>
      ))}
      {data.length > TOP_N && (
        <button className="mini-chart-expand" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show top 5' : `Show all ${data.length}`}
        </button>
      )}
    </div>
  );
}

export function AgentAnalytics({ agents, events }: { agents: Agent[]; events: AgentEvent[] }) {
  const [collapsed, setCollapsed] = useState(true);

  const metrics = useMemo(() => {
    const agentNames = new Map(agents.map((a) => [a.id, a.name]));

    // 1. Total Wealth
    const wealth = agents
      .map((a) => ({ name: a.name, value: a.tokenBalance + a.stakedTokens }))
      .sort((a, b) => b.value - a.value);

    // 2. Top Earners — sum WORK from earned_tokens events
    const earnings = new Map<string, number>();
    for (const e of events) {
      if (e.action === 'earned_tokens') {
        const match = e.detail.match(/(\d+) WORK/);
        if (match) {
          earnings.set(e.agentName, (earnings.get(e.agentName) || 0) + parseInt(match[1], 10));
        }
      }
    }
    const topEarners = Array.from(earnings.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 3. Jobs Completed
    const jobsCompleted = agents
      .map((a) => ({ name: a.name, value: a.completedJobs }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);

    // 4. Win Rate — assigned / bids placed
    const bidsPlaced = new Map<string, number>();
    const jobsAssigned = new Map<string, number>();
    for (const e of events) {
      if (e.action === 'placed_bid') {
        bidsPlaced.set(e.agentName, (bidsPlaced.get(e.agentName) || 0) + 1);
      }
      if (e.action === 'assigned_job') {
        jobsAssigned.set(e.agentName, (jobsAssigned.get(e.agentName) || 0) + 1);
      }
    }
    const winRate = Array.from(bidsPlaced.entries())
      .map(([name, bids]) => ({
        name,
        value: bids > 0 ? (jobsAssigned.get(name) || 0) / bids : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // 5. Reputation
    const reputation = agents
      .map((a) => ({ name: a.name, value: a.reputationScore }))
      .sort((a, b) => b.value - a.value);

    // 6. Rejection Rate as Worker
    // Count approved_work and rejected_work per worker
    const workerApprovals = new Map<string, number>();
    const workerRejections = new Map<string, number>();
    for (const e of events) {
      if (e.action === 'approved_work') {
        // The worker is in the detail: "released to WorkerName"
        const match = e.detail.match(/released to (\w+)/);
        if (match) {
          const worker = match[1];
          workerApprovals.set(worker, (workerApprovals.get(worker) || 0) + 1);
        }
      }
      if (e.action === 'rejected_work') {
        const match = e.detail.match(/kill fee to (\w+)/);
        if (match) {
          const worker = match[1];
          workerRejections.set(worker, (workerRejections.get(worker) || 0) + 1);
        }
      }
    }
    const allWorkers = new Set([...workerApprovals.keys(), ...workerRejections.keys()]);
    const rejectionRate = Array.from(allWorkers)
      .map((name) => {
        const approved = workerApprovals.get(name) || 0;
        const rejected = workerRejections.get(name) || 0;
        const total = approved + rejected;
        return { name, value: total > 0 ? rejected / total : 0 };
      })
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);

    // 7. x402 Spend
    const kiteSpend = new Map<string, number>();
    for (const e of events) {
      if (e.action === 'x402_payment') {
        const match = e.detail.match(/([\d.]+) KITE/);
        if (match) {
          kiteSpend.set(e.agentName, (kiteSpend.get(e.agentName) || 0) + parseFloat(match[1]));
        }
      }
    }
    const x402Spend = Array.from(kiteSpend.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 8. Poster Rejection Rate
    const posterApprovals = new Map<string, number>();
    const posterRejections = new Map<string, number>();
    for (const e of events) {
      if (e.action === 'approved_work') {
        posterApprovals.set(e.agentName, (posterApprovals.get(e.agentName) || 0) + 1);
      }
      if (e.action === 'rejected_work') {
        posterRejections.set(e.agentName, (posterRejections.get(e.agentName) || 0) + 1);
      }
    }
    const allPosters = new Set([...posterApprovals.keys(), ...posterRejections.keys()]);
    const posterRejRate = Array.from(allPosters)
      .map((name) => {
        const approved = posterApprovals.get(name) || 0;
        const rejected = posterRejections.get(name) || 0;
        const total = approved + rejected;
        return { name, value: total > 0 ? rejected / total : 0 };
      })
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);

    return { wealth, topEarners, jobsCompleted, winRate, reputation, rejectionRate, x402Spend, posterRejRate };
  }, [agents, events]);

  return (
    <div className={`agent-analytics ${collapsed ? 'collapsed' : ''}`}>
      <div className="panel-header" onClick={() => setCollapsed(!collapsed)}>
        <h2 className="panel-title">Agent Performance</h2>
        <span className={`collapse-toggle ${collapsed ? 'collapsed' : ''}`}>&#x25BE;</span>
      </div>
      {!collapsed && (
        <div className="analytics-grid">
          <MiniBarChart title="Total Wealth" data={metrics.wealth} color="#22c55e" format={(v) => `${v} WORK`} />
          <MiniBarChart title="Top Earners" data={metrics.topEarners} color="#22c55e" format={(v) => `${v} WORK`} />
          <MiniBarChart title="Jobs Completed" data={metrics.jobsCompleted} color="#22c55e" />
          <MiniBarChart title="Bid Win Rate" data={metrics.winRate} color="#3b82f6" format={(v) => `${Math.round(v * 100)}%`} />
          <MiniBarChart title="Reputation" data={metrics.reputation} color="#a78bfa" format={(v) => `${v}%`} />
          <MiniBarChart title="Worker Rejection Rate" data={metrics.rejectionRate} color="#ef4444" format={(v) => `${Math.round(v * 100)}%`} />
          <MiniBarChart title="x402 Spend" data={metrics.x402Spend} color="#f59e0b" format={(v) => `${v.toFixed(4)} KITE`} />
          <MiniBarChart title="Poster Rejection Rate" data={metrics.posterRejRate} color="#ef4444" format={(v) => `${Math.round(v * 100)}%`} />
        </div>
      )}
    </div>
  );
}
