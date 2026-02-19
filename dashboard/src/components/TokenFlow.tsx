import { Agent, AgentEvent } from '../hooks/useEventStream';

interface TokenEdge {
  from: string;
  to: string;
  amount: number;
  killFee?: boolean;
}

export function TokenFlow({ agents, events }: { agents: Agent[]; events: AgentEvent[] }) {
  // Build edges from earned_tokens / approved_work / rejected_work events
  const edges: TokenEdge[] = [];
  const seen = new Set<string>();

  for (const e of events) {
    if (e.action === 'approved_work' && e.jobId) {
      const earned = events.find(
        (ev) => ev.jobId === e.jobId && ev.action === 'earned_tokens'
      );
      if (earned) {
        const key = `approve-${e.agentId}-${earned.agentId}`;
        if (!seen.has(key)) {
          seen.add(key);
          const amount = parseInt(e.detail.match(/(\d+) WORK/)?.[1] || '0', 10);
          if (amount > 0) {
            edges.push({ from: e.agentName, to: earned.agentName, amount });
          }
        }
      }
    }

    if (e.action === 'rejected_work' && e.jobId) {
      const killMatch = e.detail.match(/(\d+) WORK kill fee to (\w+)/);
      if (killMatch) {
        const amount = parseInt(killMatch[1], 10);
        const workerName = killMatch[2];
        const key = `kill-${e.agentId}-${workerName}-${e.jobId}`;
        if (!seen.has(key)) {
          seen.add(key);
          edges.push({ from: e.agentName, to: workerName, amount, killFee: true });
        }
      }
    }
  }

  if (agents.length === 0) {
    return (
      <div className="token-flow">
        <h2 className="panel-title">Token Flow</h2>
        <div className="empty">No agents to visualize</div>
      </div>
    );
  }

  const cx = 200;
  const cy = 130;
  const r = 100;
  const n = agents.length;

  // Position agents in a circle
  const positions = agents.map((_, i) => ({
    x: cx + r * Math.cos((2 * Math.PI * i) / n - Math.PI / 2),
    y: cy + r * Math.sin((2 * Math.PI * i) / n - Math.PI / 2),
  }));

  const agentIdx = new Map(agents.map((a, i) => [a.name, i]));

  return (
    <div className="token-flow">
      <h2 className="panel-title">Token Flow</h2>
      <svg viewBox="0 0 400 270" className="token-flow-svg">
        {/* Edges */}
        {edges.map((edge, i) => {
          const fi = agentIdx.get(edge.from);
          const ti = agentIdx.get(edge.to);
          if (fi === undefined || ti === undefined) return null;
          const from = positions[fi];
          const to = positions[ti];
          // Shorten line so arrow sits at node edge (radius 22)
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const ux = dx / len;
          const uy = dy / len;
          const x1 = from.x + ux * 24;
          const y1 = from.y + uy * 24;
          const x2 = to.x - ux * 24;
          const y2 = to.y - uy * 24;
          const mx = (from.x + to.x) / 2;
          const my = (from.y + to.y) / 2;
          // Offset label perpendicular to line so it doesn't overlap
          const px = -uy * 10;
          const py = ux * 10;
          return (
            <g key={i}>
              <line
                x1={x1} y1={y1}
                x2={x2} y2={y2}
                stroke="#c0392b"
                strokeWidth={Math.max(1.5, Math.min(3, edge.amount / 20))}
                opacity={edge.killFee ? 0.7 : 0.5}
                strokeDasharray={edge.killFee ? '5 3' : 'none'}
                markerEnd={edge.killFee ? 'url(#arrow-kill)' : 'url(#arrow)'}
              />
              <text
                x={mx + px}
                y={my + py}
                fill={edge.killFee ? '#c0392b' : '#888'}
                fontSize="9"
                textAnchor="middle"
                fontFamily="JetBrains Mono, monospace"
              >
                {edge.amount} WORK{edge.killFee ? ' (kill fee)' : ''}
              </text>
            </g>
          );
        })}

        {/* Agent nodes */}
        {agents.map((agent, i) => (
          <g key={agent.id}>
            <circle
              cx={positions[i].x}
              cy={positions[i].y}
              r={22}
              fill="#181818"
              stroke={agent.status === 'working' ? '#c0392b' : '#2a2a2a'}
              strokeWidth={agent.status === 'working' ? 1.5 : 1}
            />
            <text
              x={positions[i].x}
              y={positions[i].y - 5}
              fill="#d4d4d4"
              fontSize="9.5"
              textAnchor="middle"
              fontWeight="500"
              fontFamily="Inter, sans-serif"
            >
              {agent.name}
            </text>
            <text
              x={positions[i].x}
              y={positions[i].y + 9}
              fill="#505050"
              fontSize="8"
              textAnchor="middle"
              fontFamily="JetBrains Mono, monospace"
            >
              {agent.tokenBalance}
            </text>
          </g>
        ))}

        {/* Arrow markers */}
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#c0392b" />
          </marker>
          <marker id="arrow-kill" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#c0392b" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
