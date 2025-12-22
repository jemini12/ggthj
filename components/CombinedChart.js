import { useMemo, useState } from "react";

function parseDate(ymd) {
  const [y, m, d] = ymd.split("-").map((v) => parseInt(v, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

function niceTicks(maxValue, desired = 4) {
  if (!isFinite(maxValue) || maxValue <= 0) return [0];
  const raw = maxValue / desired;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let step;
  if (norm < 1.5) step = 1 * mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const niceMax = Math.ceil(maxValue / step) * step;
  const ticks = [];
  for (let v = 0; v <= niceMax + 1e-9; v += step) {
    ticks.push(Math.round(v));
  }
  return ticks;
}

function formatInt(n) {
  return new Intl.NumberFormat("ko-KR").format(n);
}

export default function CombinedChart({ points, width = 1000, height = 380, pad = 52, showCumsum = true }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const leftPad = pad + 8;
  const rightPad = Math.max(32, pad - 12);
  const topPad = pad + 8;
  const bottomPad = pad + 16;
  const effectiveWidth = useMemo(() => {
    const minWidth = 720;
    const bars = points && points.length ? points.length * 14 : 0;
    return Math.max(width, leftPad + rightPad + bars, minWidth);
  }, [points, width, leftPad, rightPad]);

  const { bars, linePoints, countTicks, cumTicks, xTicks, maxCount, maxCum } = useMemo(() => {
    if (!points || points.length === 0) {
      return { bars: [], linePoints: [], countTicks: [], cumTicks: [], xTicks: [], maxCount: 0, maxCum: 0 };
    }

    const plotW = effectiveWidth - leftPad - rightPad;
    const plotH = height - topPad - bottomPad;
    const counts = points.map((p) => p.count || 0);
    const maxCount = Math.max(...counts, 1);
    const cumsum = [];
    let maxCum = 0;
    if (showCumsum) {
      let running = 0;
      for (const p of points) {
        running += p.count || 0;
        cumsum.push({ date: p.date, total: running });
      }
      maxCum = Math.max(...cumsum.map((p) => p.total), 1);
    }

    const countTicks = niceTicks(maxCount, 4);
    const countScaleMax = Math.max(...countTicks, maxCount, 1);

    const barW = points.length ? plotW / points.length : plotW;
    const bars = points.map((p, i) => {
      const x = leftPad + i * barW;
      const h = (plotH * p.count) / countScaleMax;
      const y = topPad + (plotH - h);
      return { ...p, x, y, w: Math.max(1, barW - 1), h };
    });

    const linePoints = showCumsum
      ? cumsum.map((p, i) => {
          const x = leftPad + (points.length === 1 ? plotW / 2 : (plotW / (points.length - 1)) * i);
          const y = topPad + plotH * (1 - p.total / Math.max(1, maxCum));
          return { ...p, x, y };
        })
      : [];

    const cumTicks = [];
    if (showCumsum && linePoints.length) {
      niceTicks(maxCum, 4).forEach((v) => cumTicks.push(v));
    }
    const cumScaleMax = Math.max(...cumTicks, maxCum, 1);

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

    return { bars, linePoints, countTicks, cumTicks, xTicks, maxCount: countScaleMax, maxCum: cumScaleMax };
  }, [points, width, height, pad, showCumsum, effectiveWidth, topPad, bottomPad, leftPad, rightPad]);

  const hover = hoverIdx != null ? bars[hoverIdx] : null;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${effectiveWidth} ${height}`}
        width={effectiveWidth}
        height={height}
        className="block"
        style={{ minWidth: effectiveWidth }}
      >
        <rect x="0" y="0" width={effectiveWidth} height={height} fill="#ffffff" />

        {/* grid + axes */}
        {countTicks.map((v, idx) => {
          const y = topPad + (height - topPad - bottomPad) * (1 - v / Math.max(1, maxCount));
          return (
            <g key={`count-${idx}`}>
              <line x1={leftPad} x2={effectiveWidth - rightPad} y1={y} y2={y} stroke="rgba(15,23,42,0.08)" />
              <text x={leftPad - 10} y={y + 4} textAnchor="end" fontSize="11" fill="rgba(15,23,42,0.7)">
                {formatInt(v)}
              </text>
            </g>
          );
        })}

        {showCumsum &&
          cumTicks.map((v, idx) => {
            const y = topPad + (height - topPad - bottomPad) * (1 - v / Math.max(1, maxCum));
            return (
              <text
                key={`cum-${idx}`}
                x={effectiveWidth - rightPad + 8}
                y={y + 4}
                textAnchor="start"
                fontSize="11"
                fill="rgba(234,88,12,0.8)"
              >
                {formatInt(v)}
              </text>
            );
          })}

        <line x1={leftPad} x2={leftPad} y1={topPad} y2={height - bottomPad} stroke="rgba(15,23,42,0.2)" />
        {/* cumulative y-axis line removed to reduce visual clutter */}
        <line x1={leftPad} x2={effectiveWidth - rightPad} y1={height - bottomPad} y2={height - bottomPad} stroke="rgba(15,23,42,0.2)" />

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
        {showCumsum && linePoints.length ? (
          <path
            d={linePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ")}
            fill="none"
            stroke="#ea580c"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ) : null}

        {showCumsum &&
          linePoints.map((p, i) => (
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
          <g key={idx} transform={`translate(${t.x},${height - bottomPad})`}>
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

        {hover && showCumsum ? (
          <g>
            <rect
              x={Math.min(effectiveWidth - rightPad - 230, Math.max(leftPad, hover.x + 10))}
              y={pad + 6}
              width="220"
              height="64"
              rx="12"
              fill="rgba(15,23,42,0.9)"
              stroke="rgba(255,255,255,0.08)"
            />
            <text
              x={Math.min(effectiveWidth - rightPad - 220, Math.max(leftPad + 12, hover.x + 22))}
              y={pad + 28}
              fontSize="12"
              fill="#e5e7eb"
            >
              {hover.date}
            </text>
            <text
              x={Math.min(effectiveWidth - rightPad - 220, Math.max(leftPad + 12, hover.x + 22))}
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
