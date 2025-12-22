const { readStore, todayUtcYmd } = require("../../lib/blobStore");
const { refreshCityFull } = require("../../lib/refreshCity");

function log(event, payload) {
  try {
    console.log(JSON.stringify({ event, ...payload }));
  } catch (_) {
    console.log(event, payload);
  }
}

const inflightCityRefresh = new Map();
const storeCache = new Map(); // key: ymd, value: store object

async function loadStoreCached({ ymd }) {
  const cached = storeCache.get(ymd);
  if (cached) return cached;
  const store = await readStore({ ymd });
  if (store) storeCache.set(ymd, store);
  return store;
}

export default async function handler(req, res) {
  const city = String(req.query.city || "").trim();
  if (!city) {
    res.status(400).json({ error: "Missing required query param: city" });
    return;
  }

  if (!/^[a-z0-9_-]+$/i.test(city)) {
    res.status(400).json({ error: "Invalid city name" });
    return;
  }

  const today = todayUtcYmd();
  try {
    const startedAt = Date.now();
    let store = await loadStoreCached({ ymd: today });

    // If today's blob is missing or doesn't contain this city, do a full refresh for this city.
    let attemptedRefresh = false;
    let refreshError = null;
    let refreshResult = null;
    if (!store || !store.cities || !store.cities[city]) {
      attemptedRefresh = true;
      const fromYmd = process.env.BACKFILL_FROM || "2025-10-15";
      const now = new Date();
      const todayUtc = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      );
      const y = new Date(todayUtc.getTime() - 24 * 60 * 60 * 1000);
      const toYmd = `${y.getUTCFullYear()}-${String(y.getUTCMonth() + 1).padStart(2, "0")}-${String(
        y.getUTCDate()
      ).padStart(2, "0")}`;

      log("daily.refreshCity.start", { city, today, fromYmd, toYmd });

      if (!inflightCityRefresh.has(city)) {
        inflightCityRefresh.set(
          city,
          refreshCityFull({ city, fromYmd, toYmd, timeoutMs: 10000 }).finally(() => {
            inflightCityRefresh.delete(city);
          })
        );
      }

      try {
        refreshResult = await inflightCityRefresh.get(city);
        if (refreshResult && refreshResult.store) {
          storeCache.set(today, refreshResult.store);
        }
      } catch (err) {
        refreshError = err && err.message ? err.message : String(err);
        log("daily.refreshCity.error", { city, today, error: refreshError });
      }

      // Prefer the in-memory result to avoid any read-after-write caching issues.
      store =
        refreshResult && refreshResult.store ? refreshResult.store : await loadStoreCached({ ymd: today });
    }

    if (!store || !store.cities || !store.cities[city]) {
      log("daily.miss", {
        city,
        today,
        attemptedRefresh,
        refreshError,
        durationMs: Date.now() - startedAt,
      });
      res.status(404).json({
        error: "No data for city (refresh failed or returned no rows)",
        meta: { today, attemptedRefresh, refreshError },
      });
      return;
    }

    log("daily.ok", {
      city,
      today,
      storeDate: store.date || today,
      attemptedRefresh,
      durationMs: Date.now() - startedAt,
    });
    res.status(200).json({
      city,
      storeDate: store.date || today,
      keyword: store.keyword,
      updatedAt: store.updatedAt,
      meta: { today, attemptedRefresh, refreshError, stale: (store.date || today) !== today },
      points: store.cities[city].points || [],
    });
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    log("daily.error", { city, today, error: msg });
    res.status(500).json({ error: msg, meta: { today } });
  }
}
