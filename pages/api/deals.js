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
    const isRolling = req.query.rolling12 === "1";
    const searchYear = parseYear(req.query.year) || nowYear;
    const gubun = sanitize(req.query.gubun, ["TRDE", "LFMT", "LFMT_Y", "LFMT_M"]) || "TRDE";
    const bdsGbn = sanitize(req.query.bdsGbn, ["ALL", "01", "02", "03", "04", "05", "06"]) || "01";
    const sggCd = req.query.sggCd ? String(req.query.sggCd).trim() : "";

    const cacheKey = JSON.stringify({ searchYear, gubun, bdsGbn, sggCd, isRolling });
    const cached = getCache(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    let finalPoints = [];

    if (isRolling) {
      // Fetch last 12 months (current year + previous year)
      const [prevYearData, currYearData] = await Promise.all([
        fetchDealMonthList({ searchYear: nowYear - 1, gubun, bdsGbn, sggCd, groupDate: "gubunYear" }),
        fetchDealMonthList({ searchYear: nowYear, gubun, bdsGbn, sggCd, groupDate: "gubunYear" })
      ]).catch(() => [null, null]);

      const getRow = (data) => (data && data.sggList && data.sggList.length ? data.sggList[0] : (data && data.monthList && data.monthList.length ? data.monthList[0] : null));
      const pr = getRow(prevYearData);
      const cr = getRow(currYearData);

      const all = [];
      // Prev year
      for (let m = 1; m <= 12; m++) {
        const val = pr ? (parseInt(String(pr[`a${m}`] || "0").replace(/,/g, ""), 10) || 0) : 0;
        all.push({ date: `${nowYear - 1}-${String(m).padStart(2, "0")}-01`, count: val });
      }
      // Curr year
      for (let m = 1; m <= 12; m++) {
        const val = cr ? (parseInt(String(cr[`a${m}`] || "0").replace(/,/g, ""), 10) || 0) : 0;
        all.push({ date: `${nowYear}-${String(m).padStart(2, "0")}-01`, count: val });
      }

      // Slice last 12 months based on current month
      const nowMonth = new Date().getMonth() + 1; // 1-12
      finalPoints = all.slice(nowMonth, nowMonth + 12);
    } else {
      const data = await fetchDealMonthList({ searchYear, gubun, bdsGbn, sggCd, groupDate: "gubunYear" });
      const getRow = (data) => (data.sggList && data.sggList.length ? data.sggList[0] : (data.monthList && data.monthList.length ? data.monthList[0] : null));
      const row = getRow(data);
      if (row) {
        for (let m = 1; m <= 12; m++) {
          const val = parseInt(String(row[`a${m}`] || "0").replace(/,/g, ""), 10) || 0;
          finalPoints.push({ date: `${searchYear}-${String(m).padStart(2, "0")}-01`, count: val });
        }
      }
    }

    const payload = {
      params: { searchYear, gubun, bdsGbn, sggCd, isRolling },
      points: finalPoints
    };
    setCache(cacheKey, payload);

    res.status(200).json(payload);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    res.status(500).json({ error: msg, detail: err.detail || null });
  }
}
