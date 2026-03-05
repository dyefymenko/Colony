import { useState } from 'react';
import { Job, Agent } from '../hooks/useEventStream';

const STATUS_COLORS: Record<string, string> = {
  open: '#a0a0a0',
  assigned: '#f59e0b',
  in_progress: '#f59e0b',
  submitted: '#f59e0b',
  review: '#f59e0b',
  completed: '#22c55e',
  disputed: '#ef4444',
  rejected: '#ef4444',
};

const FILTER_TABS: { label: string; statuses: string[] }[] = [
  { label: 'All', statuses: [] },
  { label: 'Open', statuses: ['open'] },
  { label: 'In Progress', statuses: ['assigned', 'in_progress', 'submitted', 'review'] },
  { label: 'Completed', statuses: ['completed'] },
  { label: 'Rejected', statuses: ['rejected', 'disputed'] },
];

export function JobMarketplace({ jobs, agents, onSelectJob }: { jobs: Job[]; agents: Agent[]; onSelectJob?: (id: string) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const getAgentName = (id?: string) => (id ? agentMap.get(id)?.name || id : '—');

  const toggleFilter = (idx: number) => {
    if (idx === 0) {
      setActiveFilters(new Set());
      return;
    }
    const next = new Set(activeFilters);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setActiveFilters(next);
  };

  const allowedStatuses = activeFilters.size === 0
    ? null
    : Array.from(activeFilters).flatMap((i) => FILTER_TABS[i].statuses);

  const statusFiltered = allowedStatuses
    ? jobs.filter((j) => allowedStatuses.includes(j.status))
    : jobs;

  const query = search.trim().toLowerCase();
  const filtered = query
    ? statusFiltered.filter((j) =>
        j.title.toLowerCase().includes(query) ||
        j.description.toLowerCase().includes(query) ||
        j.requiredSkill.toLowerCase().includes(query) ||
        getAgentName(j.posterId).toLowerCase().includes(query) ||
        (j.assigneeId && getAgentName(j.assigneeId).toLowerCase().includes(query))
      )
    : statusFiltered;

  const sorted = [...filtered].sort((a, b) => {
    const order = ['open', 'in_progress', 'assigned', 'submitted', 'review', 'completed', 'rejected'];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });

  return (
    <div className={`job-marketplace ${collapsed ? 'collapsed' : ''}`}>
      <div className="panel-header" onClick={() => setCollapsed(!collapsed)}>
        <h2 className="panel-title">Job Marketplace</h2>
        <span className={`collapse-toggle ${collapsed ? 'collapsed' : ''}`}>&#x25BE;</span>
      </div>
      {!collapsed && <><div className="job-search">
        <input
          type="text"
          className="job-search-input"
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="job-search-clear" onClick={() => setSearch('')}>&times;</button>
        )}
      </div>
      <div className="job-filters">
        {FILTER_TABS.map((tab, i) => (
          <button
            key={tab.label}
            className={`job-filter-tab ${(i === 0 && activeFilters.size === 0) || activeFilters.has(i) ? 'active' : ''}`}
            onClick={() => toggleFilter(i)}
          >
            {tab.label}
            {i > 0 && (
              <span className="job-filter-count">
                {jobs.filter((j) => tab.statuses.includes(j.status)).length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="job-list">
        {sorted.map((job) => (
          <div key={job.id} className="job-row" onClick={() => onSelectJob?.(job.id)} style={{ cursor: 'pointer' }}>
            <div className="job-main">
              <span
                className="job-status"
                style={{ color: STATUS_COLORS[job.status] || '#6b7280' }}
              >
                {job.status.replace('_', ' ').toUpperCase()}
              </span>
              <span className="job-title">{job.title}</span>
              <span className="job-bounty">{job.bounty} WORK</span>
            </div>
            <div className="job-meta">
              <span>Skill: {job.requiredSkill}</span>
              <span>Posted by: {getAgentName(job.posterId)}</span>
              {job.assigneeId && <span>Worker: {getAgentName(job.assigneeId)}</span>}
              {job.bids.length > 0 && job.status === 'open' && (
                <span>{job.bids.length} bid{job.bids.length !== 1 ? 's' : ''}</span>
              )}
              {parseFloat(job.totalExpenses) > 0 && (
                <span className="expense-badge">
                  {'\uD83D\uDCB8'} {job.totalExpenses} spent
                </span>
              )}
            </div>
            {job.txHash && (
              <div className="job-tx">
                <a
                  href={`https://hashscan.io/testnet/transaction/${job.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  tx: {job.txHash.slice(0, 20)}...
                </a>
              </div>
            )}
            {(job.status === 'completed' || job.status === 'rejected') &&
              job.expenses.some((e) => e.kiteTxHash) && (
              <div className="job-x402-links">
                {job.expenses.filter((e) => e.kiteTxHash).map((exp, i) => (
                  <a
                    key={i}
                    className="job-x402-link"
                    href={exp.chain === 'base'
                      ? `https://basescan.org/tx/${exp.kiteTxHash}`
                      : `https://testnet.kitescan.ai/tx/${exp.kiteTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    x402: {exp.amount} [{exp.chain === 'base' ? 'BaseScan' : 'KiteScan'} ↗]
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {sorted.length === 0 && <div className="empty">No jobs posted yet</div>}
      </div></>}
    </div>
  );
}
