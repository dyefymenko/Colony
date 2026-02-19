import { useState } from 'react';
import { useEventStream } from './hooks/useEventStream';
import { WelcomeModal } from './components/WelcomeModal';
import { AgentRoster } from './components/AgentRoster';
import { JobMarketplace } from './components/JobMarketplace';
import { TokenFlow } from './components/TokenFlow';
import { ActivityFeed } from './components/ActivityFeed';
import { DetailPanel } from './components/DetailPanel';
import './styles.css';

export default function App() {
  const { events, agents, jobs, connected } = useEventStream();
  const [selection, setSelection] = useState<{ type: 'agent' | 'job'; id: string } | null>(null);

  const totalWork = agents.reduce((s, a) => s + a.tokenBalance + a.stakedTokens, 0);
  const openJobs = jobs.filter((j) => j.status === 'open').length;
  const avgRep = agents.length
    ? Math.round(agents.reduce((s, a) => s + a.reputationScore, 0) / agents.length)
    : 0;
  const x402Spend = events
    .filter((e) => e.action === 'x402_payment')
    .reduce((s, e) => {
      const match = e.detail.match(/([\d.]+) KITE/);
      return s + (match ? parseFloat(match[1]) : 0);
    }, 0);

  return (
    <div className="app">
      <WelcomeModal />
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <svg viewBox="0 0 120 100" className="header-claw">
            <path d="M 30 60 Q 15 30 25 10 Q 30 5 35 12 Q 40 25 38 45 L 45 55" fill="none" stroke="#c0392b" strokeWidth="5" strokeLinecap="round" />
            <path d="M 38 55 Q 20 40 18 18 Q 20 10 26 16 Q 32 28 35 48" fill="none" stroke="#c0392b" strokeWidth="4" strokeLinecap="round" />
            <path d="M 90 60 Q 105 30 95 10 Q 90 5 85 12 Q 80 25 82 45 L 75 55" fill="none" stroke="#c0392b" strokeWidth="5" strokeLinecap="round" />
            <path d="M 82 55 Q 100 40 102 18 Q 100 10 94 16 Q 88 28 85 48" fill="none" stroke="#c0392b" strokeWidth="4" strokeLinecap="round" />
            <ellipse cx="60" cy="72" rx="25" ry="18" fill="#c0392b" opacity="0.2" />
            <ellipse cx="60" cy="72" rx="25" ry="18" fill="none" stroke="#c0392b" strokeWidth="2.5" />
            <circle cx="52" cy="66" r="3.5" fill="#c0392b" /><circle cx="68" cy="66" r="3.5" fill="#c0392b" />
            <circle cx="52.5" cy="65.5" r="1.2" fill="#0c0c0c" /><circle cx="68.5" cy="65.5" r="1.2" fill="#0c0c0c" />
          </svg>
          <h1 className="logo">Colony</h1>
          <span className="autonomous-badge">AUTONOMOUS</span>
          <span className={`live-indicator ${connected ? 'connected' : 'disconnected'}`}>
            <span className="live-dot" />
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
        <div className="header-right">
          <span className="hcs-id">HCS Topic: 0.0.7965660</span>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="metrics-row">
        <div className="metric">
          <span className="metric-value">{agents.length}</span>
          <span className="metric-label">Active Agents</span>
        </div>
        <div className="metric">
          <span className="metric-value">{openJobs}</span>
          <span className="metric-label">Open Jobs</span>
        </div>
        <div className="metric">
          <span className="metric-value">{totalWork.toLocaleString()}</span>
          <span className="metric-label">Circulating WORK</span>
        </div>
        <div className="metric">
          <span className="metric-value">{avgRep}%</span>
          <span className="metric-label">Avg Reputation</span>
        </div>
        <div className="metric">
          <span className="metric-value">{x402Spend.toFixed(4)} KITE</span>
          <span className="metric-label">x402 Spend</span>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="columns">
        {/* Left: Agent Roster */}
        <div className="column-left">
          <AgentRoster agents={agents} onSelectAgent={(id) => setSelection({ type: 'agent', id })} />
        </div>

        {/* Center: Jobs + Token Flow */}
        <div className="column-center">
          <JobMarketplace jobs={jobs} agents={agents} onSelectJob={(id) => setSelection({ type: 'job', id })} />
          <TokenFlow agents={agents} events={events} />
        </div>

        {/* Right: Activity Feed */}
        <div className="column-right">
          <ActivityFeed events={events} />
        </div>
      </div>

      {/* Detail Modal */}
      {selection && (
        <div className="detail-overlay" onClick={() => setSelection(null)}>
          <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
            <DetailPanel
              type={selection.type}
              agentId={selection.type === 'agent' ? selection.id : undefined}
              jobId={selection.type === 'job' ? selection.id : undefined}
              agents={agents}
              jobs={jobs}
              events={events}
              onClose={() => setSelection(null)}
              onSelectAgent={(id) => setSelection({ type: 'agent', id })}
              onSelectJob={(id) => setSelection({ type: 'job', id })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
