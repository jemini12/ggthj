// This endpoint is intentionally kept as an escape hatch. It does a full refresh
// for a single city and writes today's dated blob.
const cities = require("../../data/cities.json");
const { refreshCityFull, HARD_CODED_KEYWORD } = require("../../lib/refreshCity");

const inflight = new Map();

function toYmd(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateParam(value) {
  if (!value) return null;
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function yesterdayUtcYmd() {
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const y = new Date(todayUtc.getTime() - 24 * 60 * 60 * 1000);
  return toYmd(y);
}

export default async function handler(req, res) {
  const city = String(req.query.city || "").trim();
  if (!city) return res.status(400).json({ error: "Missing city" });
  if (!/^[a-z0-9_-]+$/i.test(city))
    return res.status(400).json({ error: "Invalid city" });

  const cityCfg = cities.find((c) => c.code === city);
  if (!cityCfg) return res.status(404).json({ error: "Unknown city" });

  const from =
    parseDateParam(req.query.from) ||
    parseDateParam(process.env.BACKFILL_FROM) ||
    new Date("2025-10-15T00:00:00Z");
  const to = parseDateParam(req.query.to) || new Date(`${yesterdayUtcYmd()}T00:00:00Z`);
  const fromYmd = toYmd(from);
  const toYmdStr = toYmd(to);

  if (inflight.has(city)) {
    return res.status(202).json({ ok: true, city, status: "in_progress" });
  }

  const job = (async () => {
    return {
      ...(await refreshCityFull({ city, fromYmd, toYmd: toYmdStr, timeoutMs: 10000 })),
    };
  })().finally(() => inflight.delete(city));

  inflight.set(city, job);

  try {
    const out = await job;
    return res.status(200).json({
      ok: true,
      city,
      label: cityCfg.label,
      keyword: HARD_CODED_KEYWORD,
      range: { from: fromYmd, to: toYmdStr },
      totalCount: typeof out.totalCount === "number" ? out.totalCount : null,
      totalPages: out.totalPages,
      updatedAt: out.store && out.store.updatedAt ? out.store.updatedAt : null,
      blobUrl: out.blobUrl,
      points: out.points,
      storeDate: out.today,
    });
  } catch (err) {
    return res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
}
