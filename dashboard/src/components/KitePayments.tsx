import { AgentEvent } from '../hooks/useEventStream';

export function KitePayments({ events }: { events: AgentEvent[] }) {
  const x402Events = events.filter((e) => e.action === 'x402_payment');

  return (
    <div className="kite-payments">
      <h2 className="panel-title">
        <span className="kite-label">x402 Payments</span>
      </h2>
      <div className="payment-list">
        {x402Events.slice(0, 20).map((event) => (
          <div key={event.id} className="payment-item">
            <div className="payment-header">
              <span className="payment-agent">{event.agentName}</span>
              <span className="payment-time">
                {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}
              </span>
            </div>
            <div className="payment-detail">{event.detail}</div>
            {event.kiteTxHash && (
              <a
                href={event.chain === 'base'
                  ? `https://sepolia.basescan.org/tx/${event.kiteTxHash}`
                  : `https://testnet.kitescan.ai/tx/${event.kiteTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="kite-tx"
              >
                {event.chain === 'base' ? '[Base]' : '[Kite]'} tx: {event.kiteTxHash.slice(0, 24)}...
              </a>
            )}
          </div>
        ))}
        {x402Events.length === 0 && <div className="empty">No x402 payments yet</div>}
      </div>
    </div>
  );
}
