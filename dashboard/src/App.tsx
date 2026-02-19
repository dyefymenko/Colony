import { useEventStream } from './hooks/useEventStream';
import { AgentRoster } from './components/AgentRoster';
import { JobMarketplace } from './components/JobMarketplace';
import { TokenFlow } from './components/TokenFlow';
import { ActivityFeed } from './components/ActivityFeed';
import { HederaAttestations } from './components/HederaAttestations';
import { KitePayments } from './components/KitePayments';
import './styles.css';

export default function App() {
  const { events, agents, jobs, connected } = useEventStream();

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
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <h1 className="logo">AgentHire</h1>
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
          <AgentRoster agents={agents} />
        </div>

        {/* Center: Jobs + Token Flow */}
        <div className="column-center">
          <JobMarketplace jobs={jobs} agents={agents} />
          <TokenFlow agents={agents} events={events} />
        </div>

        {/* Right: Activity + Blockchain Panels */}
        <div className="column-right">
          <ActivityFeed events={events} />
          <HederaAttestations events={events} />
          <KitePayments events={events} />
        </div>
      </div>
    </div>
  );
}
