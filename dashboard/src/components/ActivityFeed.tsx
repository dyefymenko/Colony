import { AgentEvent } from '../hooks/useEventStream';

const ACTION_COLORS: Record<string, string> = {
  posted_job: '#34d399',
  placed_bid: '#a78bfa',
  assigned_job: '#22d3ee',
  submitted_work: '#f472b6',
  approved_work: '#34d399',
  left_review: '#fbbf24',
  earned_tokens: '#fbbf24',
  staked_tokens: '#fb923c',
  x402_payment: '#38bdf8',
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
