const fetch = require("node-fetch");

const VIEW_URL = "https://gris.gg.go.kr/deal/selectDealamountView.do";
const API_URL = "https://gris.gg.go.kr/deal/selectDealMonthList.do";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function defaultRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const startDate = `${y - 1}${m}`; // same month, previous year
  const endDate = `${y}${m}`; // current year/month
  return { startDate, endDate, year: y };
}

function pickCookies(raw) {
  if (!raw) return "";
  return raw.map((c) => c.split(";")[0]).join("; ");
}

async function fetchDealMonthList({
  groupDate = "gubunYear", // "gubunYear" or "gubunMonth"
  searchYear,
  startDate,
  endDate,
  gubun = "TRDE", // TRDE 매매, LFMT 전월세, LFMT_Y 전세, LFMT_M 월세
  bdsGbn = "ALL", // 01 아파트, 06 분양권/입주권, 02 다세대/연립, 03 단독/다가구, 05 오피스텔, 04 토지/임야, ALL 전체
  daytype = "DEAL", // 계약일
  sggCd = "",
} = {}) {
  const { startDate: defStart, endDate: defEnd, year: defYear } = defaultRange();
  const year = searchYear || defYear;
  const sDate = startDate || defStart;
  const eDate = endDate || defEnd;

  // step 1: hit view to obtain session cookies
  const viewRes = await fetch(VIEW_URL, {
    headers: {
      "user-agent": UA,
      referer: "https://gris.gg.go.kr",
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.6,en;q=0.4",
    },
  });
  const cookies = pickCookies(viewRes.headers.raw()["set-cookie"]);

  const params = new URLSearchParams({
    groupDate,
    searchYear: String(year),
    startDate: groupDate === "gubunMonth" ? sDate : "",
    endDate: groupDate === "gubunMonth" ? eDate : "",
    gubun,
    bdsGbn,
    daytype,
    sggFlag: "",
    sggCd: sggCd || "",
    sggNm: "",
    totCnt: "",
  });

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": UA,
      referer: VIEW_URL,
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.6,en;q=0.4",
      cookie: cookies,
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Failed to fetch deal data: HTTP ${res.status}`);
    err.detail = text.slice(0, 500);
    throw err;
  }

  return res.json(); // expects { monthList: [...], sggList: [...] }
}

module.exports = {
  fetchDealMonthList,
};
