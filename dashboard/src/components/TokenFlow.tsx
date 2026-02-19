import { Agent, AgentEvent } from '../hooks/useEventStream';

interface TokenEdge {
  from: string;
  to: string;
  amount: number;
}

export function TokenFlow({ agents, events }: { agents: Agent[]; events: AgentEvent[] }) {
  // Build edges from earned_tokens / approved_work events
  const edges: TokenEdge[] = [];
  const seen = new Set<string>();

  for (const e of events) {
    if (e.action === 'approved_work' && e.jobId) {
      // Find the corresponding earned event
      const earned = events.find(
        (ev) => ev.jobId === e.jobId && ev.action === 'earned_tokens'
      );
      if (earned) {
        const key = `${e.agentId}-${earned.agentId}`;
        if (!seen.has(key)) {
          seen.add(key);
          const amount = parseInt(e.detail.match(/(\d+) WORK/)?.[1] || '0', 10);
          if (amount > 0) {
            edges.push({ from: e.agentName, to: earned.agentName, amount });
          }
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
          return (
            <g key={i}>
              <line
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
                stroke="#dc2626"
                strokeWidth={Math.max(1, Math.min(4, edge.amount / 20))}
                opacity={0.5}
                markerEnd="url(#arrow)"
              />
              <text
                x={(from.x + to.x) / 2}
                y={(from.y + to.y) / 2 - 5}
                fill="#e5e5e5"
                fontSize="9"
                textAnchor="middle"
              >
                {edge.amount}
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
              r={20}
              fill="rgba(255,255,255,0.05)"
              stroke={agent.status === 'working' ? '#dc2626' : '#333'}
              strokeWidth={agent.status === 'working' ? 2 : 1}
            />
            <text
              x={positions[i].x}
              y={positions[i].y - 4}
              fill="#e5e5e5"
              fontSize="10"
              textAnchor="middle"
              fontFamily="Inter, sans-serif"
            >
              {agent.name}
            </text>
            <text
              x={positions[i].x}
              y={positions[i].y + 10}
              fill="#777"
              fontSize="8"
              textAnchor="middle"
              fontFamily="JetBrains Mono, monospace"
            >
              {agent.tokenBalance}
            </text>
          </g>
        ))}

        {/* Arrow marker */}
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="30" refY="5"
            markerWidth="4" markerHeight="4" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
