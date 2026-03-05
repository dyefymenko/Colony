import { Agent, Job, AgentEvent } from '../hooks/useEventStream';

interface DetailPanelProps {
  type: 'agent' | 'job';
  agentId?: string;
  jobId?: string;
  agents: Agent[];
  jobs: Job[];
  events: AgentEvent[];
  onClose: () => void;
  onSelectAgent?: (id: string) => void;
  onSelectJob?: (id: string) => void;
}

export function DetailPanel({ type, agentId, jobId, agents, jobs, events, onClose, onSelectAgent, onSelectJob }: DetailPanelProps) {
  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const formatDate = (ts: string) =>
    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + formatTime(ts);

  if (type === 'agent' && agentId) {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return null;

    // Jobs where this agent is poster or assignee
    const postedJobs = jobs.filter((j) => j.posterId === agentId);
    const workedJobs = jobs.filter((j) => j.assigneeId === agentId);
    const agentEvents = events.filter((e) => e.agentId === agentId);

    // Compute WORK earned from completed jobs (winning bid amount)
    const earned = workedJobs
      .filter((j) => j.status === 'completed')
      .reduce((sum, j) => {
        const bid = j.bids.find((b) => b.agentId === agentId);
        return sum + (bid ? bid.amount : j.bounty);
      }, 0);

    // Sum x402 expenses per chain
    const allExpenses = workedJobs.flatMap((j) => j.expenses.filter((e) => e.agentId === agentId));
    const kiteSpent = allExpenses
      .filter((e) => e.chain !== 'base')
      .reduce((sum, e) => {
        const match = e.amount.match(/([\d.]+)/);
        return sum + (match ? parseFloat(match[1]) : 0);
      }, 0);
    const baseSpent = allExpenses
      .filter((e) => e.chain === 'base')
      .reduce((sum, e) => {
        const match = e.amount.match(/([\d.]+)/);
        return sum + (match ? parseFloat(match[1]) : 0);
      }, 0);

    const commissioned = postedJobs.length;
    const completed = agent.completedJobs;

    return (
      <div className="detail-panel">
        <div className="detail-header">
          <h2 className="panel-title">{agent.name}</h2>
          <button className="detail-close" onClick={onClose}>&times;</button>
        </div>

        <div className="detail-role">{agent.role}</div>

        {agent.skills.length > 0 && (
          <div className="skill-tags" style={{ marginBottom: '16px' }}>
            {agent.skills.map((skill) => (
              <span key={skill} className="skill-tag">{skill}</span>
            ))}
          </div>
        )}

        <div className="detail-stats-grid">
          <div className="detail-stat">
            <span className="detail-stat-value token">{agent.tokenBalance}</span>
            <span className="detail-stat-label">WORK</span>
          </div>
          <div className="detail-stat">
            <span className="detail-stat-value rep">{agent.reputationScore}%</span>
            <span className="detail-stat-label">Rep</span>
          </div>
          <div className="detail-stat">
            <span className="detail-stat-value earned">{earned}</span>
            <span className="detail-stat-label">Earned</span>
          </div>
          <div className="detail-stat">
            <span className="detail-stat-value spent">{kiteSpent > 0 ? kiteSpent.toFixed(4) : '0'}</span>
            <span className="detail-stat-label">x402 Kite Spent</span>
          </div>
          <div className="detail-stat">
            <span className="detail-stat-value spent">{baseSpent > 0 ? baseSpent.toFixed(6) : '0'}</span>
            <span className="detail-stat-label">x402 Base Spent</span>
          </div>
          <div className="detail-stat">
            <span className="detail-stat-value commissioned">{commissioned}</span>
            <span className="detail-stat-label">Jobs Posted</span>
          </div>
          <div className="detail-stat">
            <span className="detail-stat-value completed">{completed}</span>
            <span className="detail-stat-label">Jobs Done</span>
          </div>
        </div>

        {agent.kiteAgentPassportId && (
          <div className="detail-section">
            <h3 className="detail-section-title">Wallets</h3>
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
          </div>
        )}

        {workedJobs.length > 0 && (
          <div className="detail-section">
            <h3 className="detail-section-title">Jobs Worked</h3>
            {workedJobs.map((job) => {
              const bid = job.bids.find((b) => b.agentId === agentId);
              return (
                <div key={job.id} className="detail-job-item detail-link-card" onClick={() => onSelectJob?.(job.id)}>
                  <div className="detail-job-main">
                    <span className="detail-job-status" data-status={job.status}>
                      {job.status.replace('_', ' ')}
                    </span>
                    <span className="detail-job-title">{job.title}</span>
                  </div>
                  <div className="detail-job-info">
                    {bid && <span>Bid: {bid.amount} WORK</span>}
                    <span>Bounty: {job.bounty} WORK</span>
                    {parseFloat(job.totalExpenses) > 0 && <span>Expenses: {job.totalExpenses}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {postedJobs.length > 0 && (
          <div className="detail-section">
            <h3 className="detail-section-title">Jobs Posted</h3>
            {postedJobs.map((job) => (
              <div key={job.id} className="detail-job-item detail-link-card" onClick={() => onSelectJob?.(job.id)}>
                <div className="detail-job-main">
                  <span className="detail-job-status" data-status={job.status}>
                    {job.status.replace('_', ' ')}
                  </span>
                  <span className="detail-job-title">{job.title}</span>
                </div>
                <div className="detail-job-info">
                  <span>Bounty: {job.bounty} WORK</span>
                  <span>{job.bids.length} bid{job.bids.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="detail-section">
          <h3 className="detail-section-title">Recent Activity</h3>
          {agentEvents.slice(0, 15).map((e) => (
            <div key={e.id} className="detail-event">
              <span className="detail-event-time">{formatTime(e.timestamp)}</span>
              <span className="detail-event-text">{e.detail}</span>
            </div>
          ))}
          {agentEvents.length === 0 && <div className="detail-empty">No activity yet</div>}
        </div>
      </div>
    );
  }

  if (type === 'job' && jobId) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return null;

    const poster = agents.find((a) => a.id === job.posterId);
    const assignee = job.assigneeId ? agents.find((a) => a.id === job.assigneeId) : null;
    const jobEvents = events.filter((e) => e.jobId === jobId);

    return (
      <div className="detail-panel">
        <div className="detail-header">
          <h2 className="panel-title">{job.title}</h2>
          <button className="detail-close" onClick={onClose}>&times;</button>
        </div>

        <div className="detail-meta">
          <span className="detail-job-status" data-status={job.status}>
            {job.status.replace('_', ' ')}
          </span>
          <span>{job.bounty} WORK</span>
          <span>Skill: {job.requiredSkill}</span>
        </div>

        {job.description && (
          <div className="detail-description">
            {job.description}
          </div>
        )}

        <div className="detail-section">
          <h3 className="detail-section-title">Participants</h3>
          <div className="detail-participants">
            <div className="detail-participant">
              <span className="detail-participant-label">Posted by</span>
              <span className="detail-link" onClick={() => onSelectAgent?.(job.posterId)}>{poster?.name || job.posterId}</span>
            </div>
            {assignee && (
              <div className="detail-participant">
                <span className="detail-participant-label">Assigned to</span>
                <span className="detail-link" onClick={() => onSelectAgent?.(job.assigneeId!)}>{assignee.name}</span>
              </div>
            )}
          </div>
        </div>

        {job.bids.length > 0 && (
          <div className="detail-section">
            <h3 className="detail-section-title">Bids ({job.bids.length})</h3>
            {job.bids.map((bid, i) => {
              const bidder = agents.find((a) => a.id === bid.agentId);
              return (
                <div key={i} className="detail-bid">
                  <div className="detail-bid-header">
                    <span className="detail-bid-agent detail-link" onClick={() => onSelectAgent?.(bid.agentId)}>
                      {bidder?.name || bid.agentId}
                      {bid.agentId === job.assigneeId && <span className="detail-winner"> (winner)</span>}
                    </span>
                    <span className="detail-bid-amount">{bid.amount} WORK</span>
                  </div>
                  {bid.message && <div className="detail-bid-message">{bid.message}</div>}
                </div>
              );
            })}
          </div>
        )}

        {job.expenses.length > 0 && (
          <div className="detail-section">
            <h3 className="detail-section-title">Expenses ({job.totalExpenses})</h3>
            {job.expenses.map((exp, i) => (
              <div key={i} className="detail-expense">
                <span>{exp.amount} to {exp.service}</span>
                {exp.kiteTxHash && (
                  <a
                    className="tx-link"
                    href={exp.chain === 'base'
                      ? `https://sepolia.basescan.org/tx/${exp.kiteTxHash}`
                      : `https://testnet.kitescan.ai/tx/${exp.kiteTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {exp.chain === 'base' ? 'BaseScan' : 'KiteScan'}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="detail-section">
          <h3 className="detail-section-title">Timeline</h3>
          {jobEvents.map((e) => {
            const actor = agents.find((a) => a.id === e.agentId);
            const cleanDetail = e.detail
              .replace(`"${job.title}"`, '')
              .replace(/\s+for\s*$/g, '')
              .replace(/\s+on\s*$/g, '')
              .replace(/\s+posted\s+for\s+/g, ' posted job — ')
              .replace(/\s+for\s+for\s+/g, ' for ')
              .replace(/\s+on\s+\(/g, ' (')
              .replace(/\s+for\s+\(/g, ' (')
              .replace(/submitted work for\s*$/g, 'submitted work')
              .replace(/assigned to\s+\(/g, 'assigned (')
              .replace(/kill fee for\s*$/g, 'kill fee')
              .replace(/\s{2,}/g, ' ')
              .replace(/\s+—/g, ' —')
              .trim();
            return (
              <div key={e.id} className="detail-event">
                <span className="detail-event-time">{formatDate(e.timestamp)}</span>
                <div className="detail-event-body">
                  <span className="detail-event-action">{e.action.replace(/_/g, ' ')}</span>
                  {actor && (
                    <span className="detail-event-agent detail-link" onClick={() => onSelectAgent?.(e.agentId)}>
                      {actor.name}
                    </span>
                  )}
                  <span className="detail-event-text">{cleanDetail}</span>
                  {(e.txHash || e.kiteTxHash) && (
                    <div className="detail-event-links">
                      {e.txHash && (
                        <a className="tx-link" href={`https://hashscan.io/testnet/transaction/${e.txHash}`}
                          target="_blank" rel="noopener noreferrer">HashScan</a>
                      )}
                      {e.kiteTxHash && (
                        <a className="tx-link" href={e.chain === 'base'
                            ? `https://sepolia.basescan.org/tx/${e.kiteTxHash}`
                            : `https://testnet.kitescan.ai/tx/${e.kiteTxHash}`}
                          target="_blank" rel="noopener noreferrer">{e.chain === 'base' ? 'BaseScan' : 'KiteScan'}</a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {jobEvents.length === 0 && <div className="detail-empty">No events yet</div>}
        </div>
      </div>
    );
  }

  return null;
}
