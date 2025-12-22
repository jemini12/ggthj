import { useMemo, useState } from "react";

function parseDate(ymd) {
  const [y, m, d] = ymd.split("-").map((v) => parseInt(v, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

function formatInt(n) {
  return new Intl.NumberFormat("ko-KR").format(n);
}

export default function CombinedChart({ points, width = 1000, height = 380, pad = 52 }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const { bars, linePoints, countTicks, cumTicks, xTicks, maxCount, maxCum } = useMemo(() => {
    if (!points || points.length === 0) {
      return { bars: [], linePoints: [], countTicks: [], cumTicks: [], xTicks: [], maxCount: 0, maxCum: 0 };
    }

    const plotW = width - pad * 2;
    const plotH = height - pad * 2;
    const counts = points.map((p) => p.count || 0);
    const maxCount = Math.max(...counts, 1);
    const cumsum = [];
    let running = 0;
    for (const p of points) {
      running += p.count || 0;
      cumsum.push({ date: p.date, total: running });
    }
    const maxCum = Math.max(...cumsum.map((p) => p.total), 1);

    const barW = points.length ? plotW / points.length : plotW;
    const bars = points.map((p, i) => {
      const x = pad + i * barW;
      const h = (plotH * p.count) / Math.max(1, maxCount);
      const y = pad + (plotH - h);
      return { ...p, x, y, w: Math.max(1, barW - 1), h };
    });

    const linePoints = cumsum.map((p, i) => {
      const x = pad + (points.length === 1 ? plotW / 2 : (plotW / (points.length - 1)) * i);
      const y = pad + plotH * (1 - p.total / Math.max(1, maxCum));
      return { ...p, x, y };
    });

    const countTicks = [];
    const countTickCount = 4;
    for (let t = 0; t <= countTickCount; t++) {
      const v = Math.round((maxCount * t) / countTickCount);
      countTicks.push(v);
    }

    const cumTicks = [];
    const cumTickCount = 4;
    for (let t = 0; t <= cumTickCount; t++) {
      const v = Math.round((maxCum * t) / cumTickCount);
      cumTicks.push(v);
    }

    const xTicks = [];
    let lastTick = null;
    linePoints.forEach((lp, i) => {
      const d = parseDate(lp.date);
      if (!lastTick) {
        xTicks.push({ x: lp.x, label: lp.date });
        lastTick = d;
        return;
      }
      const diffDays = Math.round((d - lastTick) / (1000 * 60 * 60 * 24));
      if (diffDays >= 7 || i === linePoints.length - 1) {
        xTicks.push({ x: lp.x, label: lp.date });
        lastTick = d;
      }
    });

    return { bars, linePoints, countTicks, cumTicks, xTicks, maxCount, maxCum };
  }, [points, width, height, pad]);

  const hover = hoverIdx != null ? bars[hoverIdx] : null;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="block">
        <rect x="0" y="0" width={width} height={height} fill="#ffffff" />

        {/* grid + axes */}
        {countTicks.map((v, idx) => {
          const y = pad + (height - pad * 2) * (1 - v / Math.max(1, maxCount));
          return (
            <g key={`count-${idx}`}>
              <line x1={pad} x2={width - pad} y1={y} y2={y} stroke="rgba(15,23,42,0.08)" />
              <text x={pad - 10} y={y + 4} textAnchor="end" fontSize="11" fill="rgba(15,23,42,0.7)">
                {formatInt(v)}
              </text>
            </g>
          );
        })}

        {cumTicks.map((v, idx) => {
          const y = pad + (height - pad * 2) * (1 - v / Math.max(1, maxCum));
          return (
            <text
              key={`cum-${idx}`}
              x={width - pad + 8}
              y={y + 4}
              textAnchor="start"
              fontSize="11"
              fill="rgba(234,88,12,0.8)"
            >
              {formatInt(v)}
            </text>
          );
        })}

        <line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke="rgba(15,23,42,0.2)" />
        <line x1={width - pad} x2={width - pad} y1={pad} y2={height - pad} stroke="rgba(234,88,12,0.4)" />
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="rgba(15,23,42,0.2)" />

        {/* bars */}
        {bars.map((b, i) => (
          <rect
            key={b.date + i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill={i === hoverIdx ? "#f59e0b" : "#3b82f6"}
            opacity={0.85}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        ))}

        {/* cumulative line */}
        {linePoints.length ? (
          <path
            d={linePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ")}
            fill="none"
            stroke="#ea580c"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ) : null}

        {linePoints.map((p, i) => (
          <circle
            key={p.date + i}
            cx={p.x}
            cy={p.y}
            r={i === hoverIdx ? 5 : 3}
            fill={i === hoverIdx ? "#3b82f6" : "#ea580c"}
            stroke="rgba(15,23,42,0.25)"
            strokeWidth="1"
          />
        ))}

        {/* x ticks */}
        {xTicks.map((t, idx) => (
          <g key={idx} transform={`translate(${t.x},${height - pad})`}>
            <line y1="0" y2="6" stroke="rgba(15,23,42,0.25)" />
            <text
              y="18"
              textAnchor="end"
              fontSize="11"
              fill="rgba(15,23,42,0.7)"
              transform="rotate(-45)"
            >
              {t.label}
            </text>
          </g>
        ))}

        {hover ? (
          <g>
            <rect
              x={Math.min(width - pad - 230, Math.max(pad, hover.x + 10))}
              y={pad + 6}
              width="220"
              height="64"
              rx="12"
              fill="rgba(15,23,42,0.9)"
              stroke="rgba(255,255,255,0.08)"
            />
            <text
              x={Math.min(width - pad - 220, Math.max(pad + 12, hover.x + 22))}
              y={pad + 28}
              fontSize="12"
              fill="#e5e7eb"
            >
              {hover.date}
            </text>
            <text
              x={Math.min(width - pad - 220, Math.max(pad + 12, hover.x + 22))}
              y={pad + 48}
              fontSize="12"
              fill="#e5e7eb"
            >
              {formatInt(hover.count)}건 · 누적{" "}
              {formatInt(linePoints[hoverIdx] ? linePoints[hoverIdx].total : 0)}건
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
