import { Job, Agent } from '../hooks/useEventStream';

const STATUS_COLORS: Record<string, string> = {
  open: '#34d399',
  assigned: '#22d3ee',
  in_progress: '#22d3ee',
  submitted: '#f472b6',
  review: '#f472b6',
  completed: '#6b7280',
  disputed: '#ef4444',
  rejected: '#fb923c',
};

export function JobMarketplace({ jobs, agents }: { jobs: Job[]; agents: Agent[] }) {
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const getAgentName = (id?: string) => (id ? agentMap.get(id)?.name || id : '—');

  const sorted = [...jobs].sort((a, b) => {
    const order = ['open', 'in_progress', 'assigned', 'submitted', 'review', 'completed'];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });

  return (
    <div className="job-marketplace">
      <h2 className="panel-title">Job Marketplace</h2>
      <div className="job-list">
        {sorted.map((job) => (
          <div key={job.id} className="job-row">
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
                  {'\uD83D\uDCB8'} {job.totalExpenses} KITE spent
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
          </div>
        ))}
        {jobs.length === 0 && <div className="empty">No jobs posted yet</div>}
      </div>
    </div>
  );
}
