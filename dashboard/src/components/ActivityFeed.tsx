import { AgentEvent } from '../hooks/useEventStream';

const ACTION_COLORS: Record<string, string> = {
  posted_job: '#a0a0a0',
  placed_bid: '#f59e0b',
  assigned_job: '#f59e0b',
  submitted_work: '#f59e0b',
  approved_work: '#22c55e',
  left_review: '#22c55e',
  earned_tokens: '#22c55e',
  staked_tokens: '#f59e0b',
  x402_payment: '#f59e0b',
  rejected_work: '#ef4444',
  auto_released: '#22c55e',
};

const ACTION_ICONS: Record<string, string> = {
  posted_job: '+',
  placed_bid: '$',
  assigned_job: '>',
  submitted_work: '^',
  approved_work: '\u2713',
  left_review: '\u2605',
  earned_tokens: '\u25B2',
  staked_tokens: '\u25C6',
  x402_payment: '\u21C4',
  rejected_work: '\u2717',
  auto_released: '\u25B6',
};

export function ActivityFeed({ events }: { events: AgentEvent[] }) {
  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="activity-feed">
      <h2 className="panel-title">Activity Feed</h2>
      <div className="feed-list">
        {events.slice(0, 80).map((event) => (
          <div
            key={event.id}
            className="feed-item"
            style={{ borderLeftColor: ACTION_COLORS[event.action] || '#555' }}
          >
            <span className="feed-icon" style={{ color: ACTION_COLORS[event.action] }}>
              {ACTION_ICONS[event.action] || '\u2022'}
            </span>
            <span className="feed-time">{formatTime(event.timestamp)}</span>
            <div className="feed-body">
              <span className="feed-detail">{event.detail}</span>
              {(event.hcsSequenceNumber || event.txHash) && (
                <div className="feed-chain">
                  {event.hcsSequenceNumber && (
                    <span className="hcs-seq">HCS #{event.hcsSequenceNumber}</span>
                  )}
                  {event.txHash && (
                    <a
                      className="tx-link"
                      href={`https://hashscan.io/testnet/transaction/${event.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={event.txHash}
                    >
                      HashScan
                    </a>
                  )}
                  {event.kiteTxHash && (
                    <a
                      className="tx-link"
                      href={`https://testnet.kitescan.ai/tx/${event.kiteTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={event.kiteTxHash}
                    >
                      KiteScan
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {events.length === 0 && <div className="empty">Waiting for activity...</div>}
      </div>
    </div>
  );
}
