const { fetchOfferSum } = require("../../lib/sales");

const cache = new Map(); // key: JSON params, value: { ts, data }
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

function getCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function setCache(key, data) {
  cache.set(key, { ts: Date.now(), data });
}

function sanitizeDeal(val) {
  const s = String(val || "123").replace(/[^123]/g, "");
  return s.length ? s : "123";
}

function parseIntSafe(v, min, max) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return null;
  if (min != null && n < min) return null;
  if (max != null && n > max) return null;
  return n;
}

export default async function handler(req, res) {
  try {
    const area = req.query.area ? String(req.query.area).trim() : "";
    if (!area) return res.status(400).json({ error: "Missing area" });

    const deal = sanitizeDeal(req.query.deal);
    const mode = req.query.mode ? String(req.query.mode).trim() : "2";
    const sY = parseIntSafe(req.query.sY, 2000, 2100);
    const sM = parseIntSafe(req.query.sM, 1, 12);
    const eY = parseIntSafe(req.query.eY, 2000, 2100);
    const eM = parseIntSafe(req.query.eM, 1, 12);

    const cacheKey = JSON.stringify({ area, deal, mode, sY, sM, eY, eM });
    const cached = getCache(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const data = await fetchOfferSum({ area, deal, mode, sY, sM, eY, eM });
    const payload = {
      params: { area, deal, mode, sY, sM, eY, eM },
      points: data.points,
    };
    setCache(cacheKey, payload);
    res.status(200).json(payload);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    res.status(500).json({ error: msg, detail: err.detail || null });
  }
}
