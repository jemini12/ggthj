import { useMemo, useState } from "react";

function formatInt(n) {
  return new Intl.NumberFormat("ko-KR").format(n);
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

export default function StackedChart({ series, width = 1000, height = 380, pad = 52 }) {
  // series: [{ label, color, points: [{date, count}]}]
  const [hover, setHover] = useState(null);
  const topPad = pad;
  const bottomPad = pad + 16;
  const effectiveWidth = useMemo(() => Math.max(width, 720), [width]);

  const { bars, xTicks, maxTotal } = useMemo(() => {
    if (!series || !series.length) return { bars: [], xTicks: [], maxTotal: 0 };
    const dates = series[0].points.map((p) => p.date);
    const plotW = effectiveWidth - topPad * 2;
    const plotH = height - topPad - bottomPad;
    const barW = dates.length ? plotW / dates.length : plotW;

    const totals = [];
    const stacks = dates.map((d, idx) => {
      let yOffset = 0;
      const layers = series.map((s) => {
        const v = s.points[idx] ? s.points[idx].count || 0 : 0;
        const layer = { label: s.label, color: s.color, value: v, y0: yOffset };
        yOffset += v;
        return layer;
      });
      totals.push(yOffset);
      return { date: d, layers };
    });
    const maxTotal = Math.max(...totals, 1);
    const bars = stacks.map((s, i) => {
      const x = topPad + i * barW;
      return s.layers.map((layer) => {
        const h = (plotH * layer.value) / maxTotal;
        const y = topPad + (plotH - ((plotH * (layer.y0 + layer.value)) / maxTotal));
        return { x, y, w: Math.max(1, barW - 1), h, date: s.date, ...layer };
      });
    });

    const xTicks = [];
    dates.forEach((d, i) => {
      const isMonthStart = d.endsWith("-01");
      if (isMonthStart || i === dates.length - 1) {
        xTicks.push({ x: topPad + i * barW, label: d });
      }
    });

    return { bars: bars.flat(), xTicks, maxTotal };
  }, [series, effectiveWidth, height, pad, topPad, bottomPad]);

  const hoverBar = hover != null ? bars[hover] : null;

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

        {niceTicks(maxTotal, 4).map((tick, idx, arr) => {
          const y = topPad + (height - topPad - bottomPad) * (1 - tick / Math.max(1, arr[arr.length - 1]));
          return (
            <g key={idx}>
              <line x1={topPad} x2={effectiveWidth - topPad} y1={y} y2={y} stroke="rgba(15,23,42,0.08)" />
              <text
                x={topPad - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="rgba(15,23,42,0.6)"
              >
                {formatInt(tick)}
              </text>
            </g>
          );
        })}

        <line x1={topPad} x2={topPad} y1={topPad} y2={height - bottomPad} stroke="rgba(15,23,42,0.2)" />
        <line x1={topPad} x2={effectiveWidth - topPad} y1={height - bottomPad} y2={height - bottomPad} stroke="rgba(15,23,42,0.2)" />

        {bars.map((b, i) => (
          <rect
            key={`${b.date}-${b.label}-${i}`}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill={b.color}
            opacity={hover === i ? 1 : 0.9}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}

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

        {hoverBar ? (
          <g>
            <rect
              x={Math.min(effectiveWidth - pad - 230, Math.max(pad, hoverBar.x + 10))}
              y={pad + 6}
              width="220"
              height="74"
              rx="12"
              fill="rgba(15,23,42,0.9)"
              stroke="rgba(255,255,255,0.08)"
            />
            <text
              x={Math.min(effectiveWidth - pad - 220, Math.max(pad + 12, hoverBar.x + 22))}
              y={pad + 28}
              fontSize="12"
              fill="#e5e7eb"
            >
              {hoverBar.date}
            </text>
            <text
              x={Math.min(effectiveWidth - pad - 220, Math.max(pad + 12, hoverBar.x + 22))}
              y={pad + 48}
              fontSize="12"
              fill="#e5e7eb"
            >
              {hoverBar.label} {formatInt(hoverBar.value)}건
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
