const cities = require("../../../data/cities.json");

function log(event, payload) {
  try {
    console.log(JSON.stringify({ level: "info", event, ...payload }));
  } catch (_) {
    console.log(event, payload);
  }
}

export default async function handler(req, res) {
  const host = req.headers.host || process.env.VERCEL_URL || "localhost:3000";
  const base = host.startsWith("http") ? host : `https://${host}`;
  const targets = cities.map((c) => `/${c.code}`);
  const started = Date.now();
  const results = [];

  for (const path of targets) {
    const url = `${base}${path}`;
    const t0 = Date.now();
    try {
      const r = await fetch(url, { method: "GET", redirect: "manual" });
      results.push({ path, status: r.status, ms: Date.now() - t0 });
    } catch (err) {
      results.push({ path, error: err && err.message ? err.message : String(err), ms: Date.now() - t0 });
    }
  }

  log("cron.ping.done", { totalMs: Date.now() - started, results });
  res.status(200).json({ ok: true, results });
}
