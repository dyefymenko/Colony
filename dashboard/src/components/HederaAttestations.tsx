import { AgentEvent } from '../hooks/useEventStream';

export function HederaAttestations({ events }: { events: AgentEvent[] }) {
  const hcsEvents = events.filter((e) => e.hcsSequenceNumber || e.txHash);

  return (
    <div className="hedera-attestations">
      <h2 className="panel-title">Hedera Attestations</h2>
      <div className="attestation-list">
        {hcsEvents.slice(0, 20).map((event) => (
          <div key={event.id} className="attestation-item">
            <div className="attestation-header">
              {event.hcsSequenceNumber && (
                <span className="hcs-seq">HCS #{event.hcsSequenceNumber}</span>
              )}
              <span className="attestation-action">{event.action.replace(/_/g, ' ')}</span>
              <span className="attestation-time">
                {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}
              </span>
            </div>
            <div className="attestation-detail">{event.detail}</div>
            {event.txHash && (
              <a
                className="tx-link"
                href={`https://hashscan.io/testnet/transaction/${event.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                title={event.txHash}
              >
                View on HashScan
              </a>
            )}
          </div>
        ))}
        {hcsEvents.length === 0 && <div className="empty">No attestations yet</div>}
      </div>
    </div>
  );
}
