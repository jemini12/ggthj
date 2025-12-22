export default async function handler(req, res) {
  try {
    const cfg = require("../../data/cities.json");
    res.status(200).json({
      cities: cfg.map((c) => c.code),
      labels: cfg.reduce((acc, c) => {
        acc[c.code] = c.label;
        return acc;
      }, {}),
      sgg: cfg.reduce((acc, c) => {
        if (c.sggCd) acc[c.code] = c.sggCd;
        return acc;
      }, {}),
    });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
}
