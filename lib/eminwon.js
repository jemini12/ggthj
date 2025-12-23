const fetch = require("node-fetch");
const https = require("https");

const HARD_CODED_FIELD = "mw_afr_nm";
const HARD_CODED_KEYWORD = "토지거래계약허가";
const VALID_STATUSES = ["처리중", "해결", "취하"];

const ACTION_PATH =
  "/emwp/gov/mogaha/ntis/web/caf/mwwd/action/CafMwWdOpenAction.do";

const BASE_PARAMS = {
  method: "selectListMwOpn",
  menu_id: "CAFOPNWebMwOpenL",
  jndinm: "CafMwWdOpenEJB",
  methodnm: "selectListMwOpn",
  context: "NTIS",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toYmdCompact(date) {
  return toYmd(date).replace(/-/g, "");
}

function parseTotalCount(html) {
  const m = html.match(/총\s*([\d,]+)\s*건/);
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ""), 10);
}

function parseRows(html) {
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const colRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const rowRaw = m[1];
    const cols = [];
    let cm;
    while ((cm = colRe.exec(rowRaw)) !== null) {
      cols.push(cm[1].replace(/<[^>]*>/g, "").trim());
    }
    if (cols.length > 0 && !cols[0].includes("접수번호")) {
      rows.push({
        id: cols[0],
        date: cols[1],
        title: cols[2],
        period: cols[3],
        status: cols[4],
        dept: cols[5],
      });
    }
  }
  return rows;
}

function countDeptMatches(rows, includes = []) {
  const counts = {};
  includes.forEach((incRaw) => {
    const inc = String(incRaw || "").trim();
    if (!inc) return;
    const incRe = new RegExp(inc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    let cnt = 0;
    rows.forEach((row) => {
      // Check both dept and title/content if needed, but here we focus on row content
      if (incRe.test(row.dept)) cnt += 1;
    });
    counts[inc] = cnt;
  });
  return counts;
}

function countStatus(rows) {
  const counts = {};
  rows.forEach((row) => {
    const s = row.status;
    if (VALID_STATUSES.includes(s)) {
      counts[s] = (counts[s] || 0) + 1;
    }
  });
  return counts;
}

function makeAgentForCity(cityCfg) {
  if (!cityCfg.legacyTls) return undefined;
  return new https.Agent({
    keepAlive: true,
    minVersion: "TLSv1",
    rejectUnauthorized: cityCfg.verifyTls !== false,
  });
}

async function postWithTimeout(url, body, { timeoutMs, agent, retries, backoffMs }) {
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent":
            "Mozilla/5.0 (compatible; mw-daily-dashboard/1.0; +https://vercel.com)",
        },
        body,
        signal: controller.signal,
        agent,
      });
      const text = await res.text();
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} from ${url}`);
        err.detail = text.slice(0, 500);
        throw err;
      }
      return text;
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(backoffMs * Math.pow(2, attempt));
      attempt += 1;
    } finally {
      clearTimeout(t);
    }
  }
}

async function fetchDailyCount({ baseUrl, cityCfg, day, timeoutMs = 10000, retries = 2, backoffMs = 250 }) {
  const url = `${baseUrl}${ACTION_PATH}`;
  const params = new URLSearchParams({
    ...BASE_PARAMS,
    field: HARD_CODED_FIELD,
    keyword: HARD_CODED_KEYWORD,
    strt_date: toYmdCompact(day),
    end_date: toYmdCompact(day),
    pageIndex: "1",
    pageSize: "200",
    pageSize1: "200",
    pageSize2: "200",
  });

  const agent = makeAgentForCity(cityCfg);
  const html = await postWithTimeout(url, params.toString(), {
    timeoutMs,
    agent,
    retries,
    backoffMs,
  });

  const rows = parseRows(html);
  const targetRows = rows.filter((r) => VALID_STATUSES.includes(r.status));

  // If city is split by 처리부서, count matching dept names instead of global total.
  if (Array.isArray(cityCfg.deptIncludes) && cityCfg.deptIncludes.length) {
    const incs = cityCfg.deptIncludes.map((i) => String(i || "").trim()).filter(Boolean);
    const incRes = incs.map((inc) => new RegExp(inc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

    const matchedRows = targetRows.filter((row) => incRes.some((re) => re.test(row.dept)));
    const statusCounts = countStatus(matchedRows);
    const count = matchedRows.length;

    // Fallback/Matches check (for internal debugging if needed)
    const matches = {};
    incs.forEach((inc, idx) => {
      matches[inc] = targetRows.filter((row) => incRes[idx].test(row.dept)).length;
    });

    return { count, matches, statusCounts };
  }

  const statusCounts = countStatus(targetRows);
  // Respect the filtered list for the daily total to ensure chart consistency
  const count = targetRows.length;
  return { count, matches: null, statusCounts };
}

module.exports = {
  HARD_CODED_KEYWORD,
  fetchDailyCount,
  toYmd,
};
