import { AgentEvent } from '../hooks/useEventStream';

const ACTION_COLORS: Record<string, string> = {
  posted_job: '#22c55e',
  placed_bid: '#eab308',
  assigned_job: '#dc2626',
  submitted_work: '#e5e5e5',
  approved_work: '#22c55e',
  left_review: '#eab308',
  earned_tokens: '#22c55e',
  staked_tokens: '#f97316',
  x402_payment: '#dc2626',
  rejected_work: '#dc2626',
  auto_released: '#f97316',
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
        {events.slice(0, 50).map((event) => (
          <div
            key={event.id}
            className="feed-item"
            style={{ borderLeftColor: ACTION_COLORS[event.action] || '#6b7280' }}
          >
            <span className="feed-icon" style={{ color: ACTION_COLORS[event.action] }}>
              {ACTION_ICONS[event.action] || '\u2022'}
            </span>
            <span className="feed-time">{formatTime(event.timestamp)}</span>
            <span className="feed-detail">{event.detail}</span>
          </div>
        ))}
        {events.length === 0 && <div className="empty">Waiting for activity...</div>}
      </div>
    </div>
  );
}
