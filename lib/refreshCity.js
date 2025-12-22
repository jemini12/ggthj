const cities = require("../data/cities.json");
const { readStore, writeStore, todayUtcYmd } = require("./blobStore");
const { fetchDailyCount, toYmd } = require("./eminwon");

const HARD_CODED_KEYWORD = "토지거래계약허가";
const CONCURRENCY = 3;

function ymdToDate(ymd) {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function daysBetweenInclusive(fromYmd, toYmd) {
  const from = ymdToDate(fromYmd);
  const to = ymdToDate(toYmd);
  if (!from || !to) throw new Error("Invalid from/to date");
  if (from > to) throw new Error("fromYmd must be <= toYmd");
  const out = [];
  const cur = new Date(from.getTime());
  while (cur <= to) {
    out.push(new Date(cur.getTime()));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

async function refreshCityFull({ city, fromYmd, toYmd: toYmdStr, timeoutMs = 10000 }) {
  const cityCfg = cities.find((c) => c.code === city);
  if (!cityCfg) throw new Error("Unknown city");

  const startedAt = Date.now();
  const log = (event, payload) => {
    try {
      console.log(JSON.stringify({ level: "info", event, city, ...payload }));
    } catch (_) {
      console.log(event, city, payload);
    }
  };
  log("refreshCity.start", { fromYmd, toYmd: toYmdStr });

  const days = daysBetweenInclusive(fromYmd, toYmdStr);
  const points = [];
  let totalCount = 0;

  // Concurrency-limited fetch of per-day counts.
  let idx = 0;
  async function worker() {
    while (idx < days.length) {
      const myIdx = idx++;
      const day = days[myIdx];
      const result = await fetchDailyCount({
        baseUrl: cityCfg.baseUrl,
        cityCfg,
        day,
        timeoutMs,
        retries: 2,
        backoffMs: 250,
      });
      const count =
        typeof result === "number" ? result : result && typeof result.count === "number" ? result.count : 0;
      const date = toYmd(day);
      points[myIdx] = { date, count };
      log("refreshCity.day", { date, count });
    }
  }
  const workers = [];
  const workerCount = Math.min(CONCURRENCY, Math.max(1, days.length));
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  totalCount = points.reduce((acc, p) => acc + (p.count || 0), 0);

  const today = todayUtcYmd();
  // Only merge into today's store (do not seed from previous days).
  let store = await readStore({ ymd: today });
  store = store && typeof store === "object" ? store : {};
  store.date = today;
  store.keyword = store.keyword || HARD_CODED_KEYWORD;
  store.cities = store.cities || {};
  store.cities[city] = { label: cityCfg.label, points };
  store.updatedAt = new Date().toISOString();

  const blob = await writeStore(store, { ymd: today });
  log("refreshCity.done", {
    today,
    totalPages: null,
    totalCount,
    pointsDays: points.length,
    durationMs: Date.now() - startedAt,
  });
  return { store, blobUrl: blob.url, totalPages: null, totalCount, points, today };
}

module.exports = {
  refreshCityFull,
  HARD_CODED_KEYWORD,
};
