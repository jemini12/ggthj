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

export default function CombinedChart({ points, width = 1000, height = 380, pad = 52, showCumsum = true, showMarkers = true, showStatus = true }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const leftPad = pad + 8;
  const rightPad = Math.max(32, pad - 12);
  const topPad = pad + 8;
  const bottomPad = pad + 16;

  const STATUSES = ["처리중", "해결", "취하"];
  const COLORS = {
    "처리중": "#3b82f6",
    "해결": "#10b981",
    "취하": "#ef4444",
  };

  const effectiveWidth = useMemo(() => {
    const minWidth = 720;
    const bars = points && points.length ? points.length * 14 : 0;
    return Math.max(width, leftPad + rightPad + bars, minWidth);
  }, [points, width, leftPad, rightPad]);

  const { barGroups, linePoints, countTicks, cumTicks, xTicks, markers, maxCount, maxCum } = useMemo(() => {
    if (!points || points.length === 0) {
      return { barGroups: [], linePoints: [], countTicks: [], cumTicks: [], xTicks: [], markers: [], maxCount: 0, maxCum: 0 };
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
    const barGroups = points.map((p, i) => {
      const x = leftPad + i * barW;
      const w = Math.max(1, barW - 1);

      const sCounts = showStatus ? (p.status || { "처리중": p.count || 0 }) : { "_total": p.count || 0 };
      let currentYOffset = 0;

      const statusList = showStatus ? STATUSES : ["_total"];
      const stacks = statusList.map(status => {
        const val = sCounts[status] || 0;
        if (val === 0) return null;
        const h = (plotH * val) / countScaleMax;
        const y = topPad + plotH - (currentYOffset + h);
        currentYOffset += h;
        return { status, h, y, w, x };
      }).filter(Boolean);

      return { ...p, x, w, stacks, count: p.count || 0, status: sCounts };
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

    // Vertical markers aligned to the LATEST date in the chart
    const markers = [];
    if (showMarkers && points.length > 0) {
      const latestDateStr = points[points.length - 1].date;
      const latestDate = parseDate(latestDateStr);
      [10, 20, 30].forEach((days) => {
        const target = new Date(latestDate.getTime() - days * 24 * 60 * 60 * 1000);
        const targetYmd = target.toISOString().split("T")[0];
        const match = barGroups.find((b) => b.date === targetYmd);
        if (match) {
          markers.push({ x: match.x + match.w / 2, label: `-${days}일` });
        }
      });
    }

    return { barGroups, linePoints, countTicks, cumTicks, xTicks, markers, maxCount: countScaleMax, maxCum: cumScaleMax };
  }, [points, width, height, pad, showCumsum, showMarkers, showStatus, effectiveWidth, topPad, bottomPad, leftPad, rightPad]);

  const hover = hoverIdx != null ? barGroups[hoverIdx] : null;

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${effectiveWidth} ${height}`}
          width={effectiveWidth}
          height={height}
          className="block"
          style={{ minWidth: effectiveWidth }}
        >
          <rect x="0" y="0" width={effectiveWidth} height={height} fill="#ffffff" />

          {/* grid lines */}
          {countTicks.map((v, idx) => {
            const y = topPad + (height - topPad - bottomPad) * (1 - v / Math.max(1, maxCount));
            return (
              <line key={`grid-${idx}`} x1={leftPad} x2={effectiveWidth - rightPad} y1={y} y2={y} stroke="rgba(15,23,42,0.06)" />
            );
          })}

          {/* y-axis labels */}
          {countTicks.map((v, idx) => {
            const y = topPad + (height - topPad - bottomPad) * (1 - v / Math.max(1, maxCount));
            return (
              <text key={`label-${idx}`} x={leftPad - 10} y={y + 4} textAnchor="end" fontSize="11" fill="rgba(15,23,42,0.7)">
                {formatInt(v)}
              </text>
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

          <line x1={leftPad} x2={leftPad} y1={topPad} y2={height - bottomPad} stroke="rgba(15,23,42,0.1)" />
          <line x1={leftPad} x2={effectiveWidth - rightPad} y1={height - bottomPad} y2={height - bottomPad} stroke="rgba(15,23,42,0.1)" />

          {/* bars */}
          {barGroups.map((group, i) => (
            <g
              key={group.date + i}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className="cursor-pointer"
            >
              {group.stacks.map((s, si) => (
                <rect
                  key={s.status + si}
                  x={s.x}
                  y={s.y}
                  width={s.w}
                  height={s.h}
                  fill={i === hoverIdx ? "#fde68a" : (COLORS[s.status] || "#3b82f6")}
                  stroke={i === hoverIdx ? "#f59e0b" : "none"}
                  opacity={0.85}
                />
              ))}
              {/* Invisible area for easier hover */}
              <rect
                x={group.x}
                y={topPad}
                width={group.w}
                height={height - topPad - bottomPad}
                fill="transparent"
              />
            </g>
          ))}

          {/* cumulative line */}
          {showCumsum && linePoints.length ? (
            <path
              d={linePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ")}
              fill="none"
              stroke="#f97316"
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
                fill={i === hoverIdx ? "#fbbf24" : "#f97316"}
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

          {/* vertical markers */}
          {markers.map((m, idx) => (
            <g key={`marker-${idx}`} pointerEvents="none">
              <line
                x1={m.x}
                x2={m.x}
                y1={topPad}
                y2={height - bottomPad}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="4 2"
                opacity="0.5"
              />
              <text
                x={m.x}
                y={topPad - 6}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="#64748b"
              >
                {m.label}
              </text>
            </g>
          ))}

          {hover && (
            <g>
              <rect
                x={Math.min(effectiveWidth - rightPad - 230, Math.max(leftPad, hover.x + 10))}
                y={topPad - 20}
                width="220"
                height={showCumsum ? 120 : 96}
                rx="12"
                fill="rgba(15,23,42,0.95)"
                stroke="rgba(255,255,255,0.15)"
              />
              <text
                x={Math.min(effectiveWidth - rightPad - 220, Math.max(leftPad + 12, hover.x + 22))}
                y={topPad + 5}
                fontSize="12"
                fontWeight="bold"
                fill="#ffffff"
              >
                {hover.date}
              </text>

              {showStatus ? (
                STATUSES.map((s, si) => {
                  const val = (hover.status && hover.status[s]) || 0;
                  return (
                    <text
                      key={s}
                      x={Math.min(effectiveWidth - rightPad - 220, Math.max(leftPad + 12, hover.x + 22))}
                      y={topPad + 25 + si * 16}
                      fontSize="11"
                      fill={COLORS[s]}
                    >
                      ● {s}: {formatInt(val)}건
                    </text>
                  );
                })
              ) : (
                <text
                  x={Math.min(effectiveWidth - rightPad - 220, Math.max(leftPad + 12, hover.x + 22))}
                  y={topPad + 25}
                  fontSize="11"
                  fill="#94a3b8"
                >
                  ● 건수: {formatInt(hover.count)}건
                </text>
              )}

              <text
                x={Math.min(effectiveWidth - rightPad - 220, Math.max(leftPad + 12, hover.x + 22))}
                y={topPad + 25 + (showStatus ? STATUSES.length * 16 : 20)}
                fontSize="11"
                fill="#e5e7eb"
                fontWeight="bold"
              >
                {showStatus ? `합계: ${formatInt(hover.count)}건` : ""}
              </text>

              {showCumsum && linePoints[hoverIdx] && (
                <text
                  x={Math.min(effectiveWidth - rightPad - 220, Math.max(leftPad + 12, hover.x + 22))}
                  y={topPad + (showStatus ? 45 + STATUSES.length * 16 : 50)}
                  fontSize="11"
                  fill="#f97316"
                >
                  누적: {formatInt(linePoints[hoverIdx].total)}건
                </text>
              )}
            </g>
          )}
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-6">
        {showStatus && STATUSES.map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[s] }} />
            <span className="text-xs font-medium text-slate-600">{s}</span>
          </div>
        ))}
        {showCumsum && (
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-6 bg-[#f97316]" />
            <span className="text-xs font-medium text-slate-600">누적 건수</span>
          </div>
        )}
      </div>
    </div>
  );
}
