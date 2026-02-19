import { useState, useRef, useCallback, useMemo } from 'react';
import { Agent, AgentEvent } from '../hooks/useEventStream';

interface TokenEdge {
  from: string;
  to: string;
  amount: number;
  killFee?: boolean;
}

/* ── Honeycomb grid layout ─────────────────────────────────────────────── */

function honeycombLayout(
  names: string[],
  width: number,
  height: number,
): Map<string, { x: number; y: number }> {
  const n = names.length;
  if (n === 0) return new Map();

  // Determine row count: prefer wider-than-tall arrangements
  const cols = Math.min(n, Math.max(2, Math.ceil(n / 2)));
  const rows = Math.ceil(n / cols);

  const padX = 50;
  const padY = 45;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;

  // Spacing
  const spacingX = cols > 1 ? usableW / (cols - 1) : 0;
  const spacingY = rows > 1 ? usableH / (rows - 1) : 0;

  const result = new Map<string, { x: number; y: number }>();
  let idx = 0;
  for (let row = 0; row < rows; row++) {
    // How many in this row
    const inRow = row < rows - 1 ? cols : n - idx;
    // Center this row horizontally
    const rowWidth = (inRow - 1) * spacingX;
    const offsetX = (usableW - rowWidth) / 2;
    // Stagger odd rows
    const staggerX = row % 2 === 1 ? spacingX * 0.5 : 0;

    for (let col = 0; col < inRow; col++) {
      const x = padX + offsetX + col * spacingX + staggerX;
      const y = padY + row * spacingY;
      result.set(names[idx], { x, y });
      idx++;
    }
  }

  return result;
}

/* ── SVG graph renderer ────────────────────────────────────────────────── */

function TokenFlowSVG({
  agents,
  edges,
  width,
  height,
}: {
  agents: Agent[];
  edges: TokenEdge[];
  width: number;
  height: number;
}) {
  const names = agents.map((a) => a.name);
  const positions = useMemo(
    () => honeycombLayout(names, width, height),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [names.join(','), width, height]
  );

  const nodeR = 26;

  return (
    <svg width={width} height={height} className="token-flow-svg">
      <defs>
        <marker id="tf-arrow" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#c0392b" />
        </marker>
        <marker id="tf-arrow-kill" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#c0392b" />
        </marker>
      </defs>

      {/* Faint connection lines between all agents (network mesh) */}
      {agents.map((a, i) =>
        agents.slice(i + 1).map((b) => {
          const pa = positions.get(a.name);
          const pb = positions.get(b.name);
          if (!pa || !pb) return null;
          return (
            <line
              key={`mesh-${a.id}-${b.id}`}
              x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              stroke="#222" strokeWidth="0.5" opacity="0.4"
            />
          );
        })
      )}

      {/* Transfer edges — curved arcs */}
      {edges.map((edge, i) => {
        const from = positions.get(edge.from);
        const to = positions.get(edge.to);
        if (!from || !to) return null;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const ux = dx / len;
        const uy = dy / len;
        // Start/end at node edge
        const x1 = from.x + ux * (nodeR + 2);
        const y1 = from.y + uy * (nodeR + 2);
        const x2 = to.x - ux * (nodeR + 2);
        const y2 = to.y - uy * (nodeR + 2);
        // Curve control point — offset perpendicular
        const curvature = Math.min(40, len * 0.2);
        const cx = (from.x + to.x) / 2 - uy * curvature;
        const cy = (from.y + to.y) / 2 + ux * curvature;
        // Label near the curve midpoint
        const lx = (from.x + to.x) / 2 - uy * (curvature + 10);
        const ly = (from.y + to.y) / 2 + ux * (curvature + 10);
        return (
          <g key={i}>
            <path
              d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
              fill="none"
              stroke="#c0392b"
              strokeWidth={Math.max(1.5, Math.min(3, edge.amount / 20))}
              opacity={edge.killFee ? 0.7 : 0.5}
              strokeDasharray={edge.killFee ? '5 3' : 'none'}
              markerEnd={edge.killFee ? 'url(#tf-arrow-kill)' : 'url(#tf-arrow)'}
            />
            <text
              x={lx} y={ly}
              fill={edge.killFee ? '#c0392b' : '#888'}
              fontSize="9" textAnchor="middle"
              fontFamily="JetBrains Mono, monospace"
            >
              {edge.amount} WORK{edge.killFee ? ' (kill fee)' : ''}
            </text>
          </g>
        );
      })}

      {/* Nodes */}
      {agents.map((agent) => {
        const pos = positions.get(agent.name);
        if (!pos) return null;
        const isWorking = agent.status === 'working';
        return (
          <g key={agent.id}>
            {/* Glow ring for working agents */}
            {isWorking && (
              <circle cx={pos.x} cy={pos.y} r={nodeR + 4}
                fill="none" stroke="#c0392b" strokeWidth="1" opacity="0.3" />
            )}
            <circle
              cx={pos.x} cy={pos.y} r={nodeR}
              fill="#181818"
              stroke={isWorking ? '#c0392b' : '#333'}
              strokeWidth={isWorking ? 2 : 1}
            />
            <text
              x={pos.x} y={pos.y - 6}
              fill="#d4d4d4" fontSize="10.5" textAnchor="middle"
              fontWeight="600" fontFamily="Inter, sans-serif"
            >
              {agent.name}
            </text>
            <text
              x={pos.x} y={pos.y + 8}
              fill="#666" fontSize="8.5" textAnchor="middle"
              fontFamily="JetBrains Mono, monospace"
            >
              {agent.tokenBalance}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Main component with pop-out window ────────────────────────────────── */

export function TokenFlow({ agents, events }: { agents: Agent[]; events: AgentEvent[] }) {
  const [poppedOut, setPoppedOut] = useState(false);
  const [winPos, setWinPos] = useState<{ x: number; y: number } | null>(null);
  const [winSize, setWinSize] = useState({ w: 700, h: 500 });
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; originW: number; originH: number } | null>(null);

  const openPopout = useCallback(() => {
    const x = Math.round((window.innerWidth - winSize.w) / 2);
    const y = Math.round((window.innerHeight - winSize.h) / 2);
    setWinPos({ x, y });
    setZoom(1);
    setPoppedOut(true);
  }, [winSize]);

  // Build edges
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
          if (amount > 0) edges.push({ from: e.agentName, to: earned.agentName, amount });
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

  // Window dragging
  const onTitleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!winPos) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: winPos.x, originY: winPos.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setWinPos({
        x: dragRef.current.originX + ev.clientX - dragRef.current.startX,
        y: Math.max(0, dragRef.current.originY + ev.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, [winPos]);

  // Window resizing
  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, originW: winSize.w, originH: winSize.h };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      setWinSize({
        w: Math.max(400, resizeRef.current.originW + ev.clientX - resizeRef.current.startX),
        h: Math.max(300, resizeRef.current.originH + ev.clientY - resizeRef.current.startY),
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
  }, [winSize]);

  if (agents.length === 0) {
    return (
      <div className="token-flow">
        <h2 className="panel-title">Token Flow</h2>
        <div className="empty">No agents to visualize</div>
      </div>
    );
  }

  const svgW = poppedOut ? (winSize.w - 2) / zoom : 500;
  const svgH = poppedOut ? (winSize.h - 74) / zoom : 280;

  // Inline (not popped out)
  if (!poppedOut) {
    return (
      <div className="token-flow">
        <div className="token-flow-header">
          <h2 className="panel-title">Token Flow</h2>
          <button className="tf-popout-btn" onClick={openPopout} title="Pop out">
            &#x2922;
          </button>
        </div>
        <TokenFlowSVG agents={agents} edges={edges} width={500} height={280} />
      </div>
    );
  }

  const pos = winPos || { x: 0, y: 0 };

  // Popped-out floating window
  return (
    <>
      <div className="token-flow">
        <div className="token-flow-header">
          <h2 className="panel-title">Token Flow</h2>
          <button className="tf-popout-btn" onClick={openPopout} title="Pop out" disabled>
            &#x2922;
          </button>
        </div>
        <div className="empty">Graph popped out</div>
      </div>
      <div
        className="tf-window"
        style={{ left: pos.x, top: pos.y, width: winSize.w, height: winSize.h }}
      >
        <div className="tf-window-titlebar" onMouseDown={onTitleMouseDown}>
          <span>Token Flow</span>
          <div className="tf-window-controls">
            <div className="tf-zoom-controls">
              <button
                className="tf-zoom-btn"
                onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}
                title="Zoom out"
              >
                &minus;
              </button>
              <span className="tf-zoom-label">{Math.round(zoom * 100)}%</span>
              <button
                className="tf-zoom-btn"
                onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
                title="Zoom in"
              >
                +
              </button>
            </div>
            <button className="tf-window-close" onClick={() => setPoppedOut(false)}>&times;</button>
          </div>
        </div>
        <div className="tf-window-body">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
            <TokenFlowSVG
              agents={agents}
              edges={edges}
              width={svgW}
              height={svgH}
            />
          </div>
        </div>
        <div className="tf-window-resize" onMouseDown={onResizeMouseDown} />
      </div>
    </>
  );
}
