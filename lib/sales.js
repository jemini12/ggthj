const fetch = require("node-fetch");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function defaultRange() {
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;
  const startYear = Math.max(2022, endYear - 2); // keep within a reasonable window
  const startMonth = 12; // align with site default
  return { sY: startYear, sM: startMonth, eY: endYear, eM: endMonth };
}

function parseDateStr(str) {
  // Formats like "22/12/1"
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  const [yy, mm, dd] = parts.map((p) => parseInt(p, 10));
  if (!yy || !mm || !dd) return null;
  const year = yy + 2000;
  const d = new Date(Date.UTC(year, mm - 1, dd));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function parseChartData(body) {
  const out = [];
  const re = /chartData\[\d+\]=\{"Date":"([^"]+)","VM":(\d+),"VJ":(\d+),"VW":(\d+)\}/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const dateStr = parseDateStr(m[1]);
    const vm = parseInt(m[2], 10);
    const vj = parseInt(m[3], 10);
    const vw = parseInt(m[4], 10);
    out.push({
      date: dateStr || m[1],
      vm,
      vj,
      vw,
      total: vm + vj + vw,
    });
  }
  return out;
}

async function fetchOfferSum({
  area,
  deal = "123", // 1=매매,2=전세,3=월세; combination allowed
  mode = "2", // 2 = daily
  sY,
  sM,
  eY,
  eM,
} = {}) {
  if (!area) throw new Error("area is required");
  const range = defaultRange();
  const params = new URLSearchParams({
    apt: "",
    area: String(area),
    c_apt: "",
    c_area: "",
    c_apt2: "",
    c_area2: "",
    deal: String(deal),
    mode: String(mode),
    sSize: "",
    eSize: "",
    sY: String(sY || range.sY),
    sM: String(sM || range.sM),
    eY: String(eY || range.eY),
    eM: String(eM || range.eM),
  });

  const url = `https://asil.kr/app/data/data_offer_sum.jsp?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      "user-agent": UA,
      referer: `https://asil.kr/app/offer_sum_chart.jsp?area=${encodeURIComponent(area)}&deal=${encodeURIComponent(
        deal
      )}`,
    },
  });
  const body = await res.text();
  if (!res.ok) {
    const err = new Error(`Failed to fetch offer data: HTTP ${res.status}`);
    err.detail = body.slice(0, 500);
    throw err;
  }

  const points = parseChartData(body);
  return { points, raw: body };
}

module.exports = {
  fetchOfferSum,
};
