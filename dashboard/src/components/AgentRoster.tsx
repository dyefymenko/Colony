import { Agent } from '../hooks/useEventStream';

const AGENT_EMOJIS: Record<string, string> = {
  Codex: '💻', Sentry: '🛡️', Scraper: '🕷️', Quill: '✍️', Argus: '👁️',
};

const STATUS_COLORS: Record<string, string> = {
  idle: '#666',
  working: '#dc2626',
  bidding: '#eab308',
  posting: '#a78bfa',
};

export function AgentRoster({ agents, onSelectAgent }: { agents: Agent[]; onSelectAgent?: (id: string) => void }) {
  return (
    <div className="agent-roster">
      <h2 className="panel-title">Agent Roster</h2>
      {agents.map((agent) => (
        <div key={agent.id} className="agent-card" onClick={() => onSelectAgent?.(agent.id)} style={{ cursor: 'pointer' }}>
          <div className="agent-header">
            <span className="agent-emoji">{AGENT_EMOJIS[agent.name] || '🤖'}</span>
            <div>
              <div className="agent-name">{agent.name}</div>
              <div className="agent-role">{agent.role}</div>
            </div>
            <span
              className="status-badge"
              style={{ backgroundColor: STATUS_COLORS[agent.status] || '#6b7280' }}
            >
              {agent.status}
            </span>
          </div>

          <div className="agent-stats">
            <div className="stat">
              <span className="stat-label">WORK</span>
              <span className="stat-value token">{agent.tokenBalance}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Staked</span>
              <span className="stat-value staked">{agent.stakedTokens}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Rep</span>
              <span className="stat-value rep">{agent.reputationScore}%</span>
            </div>
            <div className="stat">
              <span className="stat-label">Jobs</span>
              <span className="stat-value">{agent.completedJobs}</span>
            </div>
          </div>

          {agent.kiteAgentPassportId && (
            <div className="kite-wallet">
              <span className="kite-wallet-label">Kite</span>
              <a
                href={`https://testnet.kitescan.ai/address/${agent.kiteAgentPassportId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="kite-wallet-address"
                title={agent.kiteAgentPassportId}
              >
                {agent.kiteAgentPassportId.slice(0, 8)}...{agent.kiteAgentPassportId.slice(-6)}
              </a>
            </div>
          )}

          <div className="skill-tags">
            {agent.skills.map((skill) => (
              <span key={skill} className="skill-tag">{skill}</span>
            ))}
          </div>
        </div>
      ))}
      {agents.length === 0 && <div className="empty">No agents registered</div>}
    </div>
  );
}
