const { put, list } = require("@vercel/blob");
const fetch = require("node-fetch");

const BLOB_PREFIX = "mw-daily-";

function todayUtcYmd() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pathnameForYmd(ymd) {
  return `${BLOB_PREFIX}${ymd}.json`;
}

async function getBlobUrlForPathname(pathname) {
  const { blobs } = await list({ prefix: pathname, limit: 10 });
  const exact = (blobs || []).find((b) => b.pathname === pathname);
  return exact ? exact.url : null;
}

async function getLatestStoreBlob() {
  const { blobs } = await list({ prefix: BLOB_PREFIX, limit: 1000 });
  const items = (blobs || [])
    .map((b) => b.pathname)
    .filter((p) => /^mw-daily-\d{4}-\d{2}-\d{2}\.json$/.test(p))
    .sort();
  if (items.length === 0) return null;
  const pathname = items[items.length - 1];
  const url = await getBlobUrlForPathname(pathname);
  if (!url) return null;
  const m = pathname.match(/^mw-daily-(\d{4}-\d{2}-\d{2})\.json$/);
  return { ymd: m ? m[1] : null, pathname, url };
}

async function readStore({ ymd } = {}) {
  const day = ymd || todayUtcYmd();
  const pathname = pathnameForYmd(day);
  const url = await getBlobUrlForPathname(pathname);
  if (!url) return null;
  // Bust CDN caches when overwriting the same pathname multiple times per day.
  const cacheBustedUrl = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
  const res = await fetch(cacheBustedUrl, {
    method: "GET",
    headers: { "cache-control": "no-cache" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch blob json: HTTP ${res.status}`);
  }
  return res.json();
}

async function writeStore(store, { ymd } = {}) {
  const day = ymd || todayUtcYmd();
  const pathname = pathnameForYmd(day);
  const body = JSON.stringify(store);
  const result = await put(pathname, body, {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
    // Avoid stale reads after overwriting the same dated file within a day.
    cacheControlMaxAge: 0,
  });
  return result; // PutBlobResult
}

module.exports = {
  BLOB_PREFIX,
  todayUtcYmd,
  pathnameForYmd,
  getLatestStoreBlob,
  readStore,
  writeStore,
};
