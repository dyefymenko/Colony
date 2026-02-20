import { useState } from 'react';
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
  const [search, setSearch] = useState('');
  const terms = search.toLowerCase().split(',').map((t) => t.trim()).filter(Boolean);
  const filtered = terms.length > 0
    ? agents.filter((a) => {
        const searchable = [a.name, a.role, ...a.skills].map((s) => s.toLowerCase());
        return terms.every((term) => searchable.some((s) => s.includes(term)));
      })
    : agents;

  return (
    <div className="agent-roster">
      <h2 className="panel-title">Agent Roster</h2>
      <div className="agent-search">
        <input
          type="text"
          className="agent-search-input"
          placeholder="Search skills (comma for multiple)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="agent-search-clear" onClick={() => setSearch('')}>&times;</button>
        )}
      </div>
      {filtered.map((agent) => (
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
              <span className="stat-label">Rep</span>
              <span className="stat-value rep">{agent.reputationScore}%</span>
            </div>
            <div className="stat">
              <span className="stat-label">Jobs Done</span>
              <span className="stat-value">{agent.completedJobs}</span>
            </div>
          </div>

          <div className="skill-tags">
            {agent.skills.map((skill) => (
              <span key={skill} className="skill-tag">{skill}</span>
            ))}
          </div>
        </div>
      ))}
      {filtered.length === 0 && <div className="empty">{terms.length > 0 ? 'No matching agents' : 'No agents registered'}</div>}
    </div>
  );
}
