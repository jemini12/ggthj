const { fetchDealMonthList } = require("../../lib/grisDeal");

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

function parseYear(value) {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 2000 && n <= 2100 ? n : null;
}

function sanitize(input, allowList) {
  if (!input) return null;
  const val = String(input).trim();
  return allowList.includes(val) ? val : null;
}

export default async function handler(req, res) {
  try {
    const nowYear = new Date().getFullYear();
    const searchYear = parseYear(req.query.year) || nowYear;
    const gubun = sanitize(req.query.gubun, ["TRDE", "LFMT", "LFMT_Y", "LFMT_M"]) || "TRDE";
  const bdsGbn = sanitize(req.query.bdsGbn, ["ALL", "01", "02", "03", "04", "05", "06"]) || "01"; // default 아파트
  const sggCd = req.query.sggCd ? String(req.query.sggCd).trim() : "";

  const cacheKey = JSON.stringify({ searchYear, gubun, bdsGbn, sggCd });
  const cached = getCache(cacheKey);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  const data = await fetchDealMonthList({
    searchYear,
    gubun,
    bdsGbn,
    sggCd,
    groupDate: "gubunYear",
  });

  const payload = {
    params: { searchYear, gubun, bdsGbn, sggCd },
    monthList: data.monthList || [],
    sggList: data.sggList || [],
  };
  setCache(cacheKey, payload);

  res.status(200).json(payload);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    res.status(500).json({ error: msg, detail: err.detail || null });
  }
}
