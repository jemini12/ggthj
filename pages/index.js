import { useEffect, useMemo, useState } from "react";
import CombinedChart from "../components/CombinedChart";
import StackedChart from "../components/StackedChart";

export async function getServerSideProps() {
  try {
    const cfg = require("../data/cities.json");
    const cities = cfg.map((c) => c.code);
    const labels = cfg.reduce((acc, c) => {
      acc[c.code] = c.label;
      return acc;
    }, {});
    const sgg = cfg.reduce((acc, c) => {
      if (c.sggCd) acc[c.code] = c.sggCd;
      return acc;
    }, {});
    return { props: { initialCities: cities, initialLabels: labels, initialSgg: sgg } };
  } catch (err) {
    return { props: { initialCities: [], initialLabels: {}, initialSgg: {} } };
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    const msg = json && json.error ? json.error : "요청에 실패했습니다.";
    throw new Error(msg);
  }
  return json;
}

export default function Home({ initialCities = [], initialLabels = {}, initialSgg = {} }) {
  const [cities, setCities] = useState(initialCities);
  const [labels, setLabels] = useState(initialLabels);
  const [sggMap, setSggMap] = useState(initialSgg);
  const [city, setCity] = useState(initialCities.includes("yongin") ? "yongin" : initialCities[0] || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [points, setPoints] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");

  const [dealPoints, setDealPoints] = useState([]);
  const [dealLoading, setDealLoading] = useState(false);
  const [dealError, setDealError] = useState("");
  const [offerSeries, setOfferSeries] = useState({ vm: [], vj: [], vw: [] });
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerError, setOfferError] = useState("");

  const MW_START = "2025-10-20";

  useEffect(() => {
    let mounted = true;
    fetchJson("/api/cities")
      .then((data) => {
        if (!mounted) return;
        const list = data.cities || [];
        setLabels(data.labels || {});
        setSggMap(data.sgg || {});
        setCities(list);
        setCity(list.includes("yongin") ? "yongin" : list[0] || "");
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e.message || String(e));
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!city) return;
    let mounted = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const data = await fetchJson(`/api/daily?city=${encodeURIComponent(city)}`);
        if (!mounted) return;
        setPoints(data.points || []);
        setUpdatedAt(data.updatedAt || "");
        setError("");
      } catch (e) {
        if (!mounted) return;
        setError(e.message || String(e));
        setPoints([]);
        setUpdatedAt("");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [city]);

  const mwPoints = useMemo(() => {
    return (points || []).filter((p) => (p.date || "") >= MW_START);
  }, [points]);

  const total = useMemo(() => {
    return (mwPoints || []).reduce((acc, p) => acc + (p.count || 0), 0);
  }, [mwPoints]);

  const dealTotal = useMemo(() => {
    return (dealPoints || []).reduce((acc, p) => acc + (p.count || 0), 0);
  }, [dealPoints]);

  const offerTotal = useMemo(() => {
    return (offerSeries.vm || []).reduce((acc, p) => acc + (p.count || 0), 0);
  }, [offerSeries]);

  function parseYmd(d) {
    if (!d) return null;
    const [y, m, day] = d.split("-").map((v) => parseInt(v, 10));
    if (!y || !m || !day) return null;
    const dt = new Date(Date.UTC(y, m - 1, day));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  function sumRange(pointsArr, start, end) {
    if (!pointsArr || !pointsArr.length || !start || !end) return 0;
    const startMs = start.getTime();
    const endMs = end.getTime();
    return pointsArr.reduce((acc, p) => {
      const dt = parseYmd(p.date);
      if (!dt) return acc;
      const t = dt.getTime();
      if (t >= startMs && t <= endMs) {
        return acc + (p.count || 0);
      }
      return acc;
    }, 0);
  }

  function latestInWindow(pointsArr, start, end) {
    if (!pointsArr || !pointsArr.length || !start || !end) return 0;
    const startMs = start.getTime();
    const endMs = end.getTime();
    let latest = 0;
    let latestTime = -Infinity;
    pointsArr.forEach((p) => {
      const dt = parseYmd(p.date);
      if (!dt) return;
      const t = dt.getTime();
      if (t >= startMs && t <= endMs && t > latestTime) {
        latest = p.count || 0;
        latestTime = t;
      }
    });
    return latest;
  }

  const summaryLines = useMemo(() => {
    const today = new Date();
    const endWeek = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const startWeek = new Date(endWeek.getTime() - 6 * 24 * 60 * 60 * 1000);
    const prevEndWeek = new Date(startWeek.getTime() - 1 * 24 * 60 * 60 * 1000);
    const prevStartWeek = new Date(prevEndWeek.getTime() - 6 * 24 * 60 * 60 * 1000);

    const mwThisWeek = sumRange(mwPoints, startWeek, endWeek);
    const mwLastWeek = sumRange(mwPoints, prevStartWeek, prevEndWeek);

    const dealMonthNow = (() => {
      if (!dealPoints || !dealPoints.length) return 0;
      const y = today.getFullYear();
      const m = today.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, "0")}-01`;
      const found = dealPoints.find((p) => p.date === key);
      return found ? found.count || 0 : 0;
    })();
    const dealMonthPrev = (() => {
      if (!dealPoints || !dealPoints.length) return 0;
      const prev = new Date(Date.UTC(today.getFullYear(), today.getMonth() - 1, 1));
      const key = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-01`;
      const found = dealPoints.find((p) => p.date === key);
      return found ? found.count || 0 : 0;
    })();

    const offerThisWeek = latestInWindow(offerSeries.vm, startWeek, endWeek);
    const offerLastWeek = latestInWindow(offerSeries.vm, prevStartWeek, prevEndWeek);
    const offerDiff = offerThisWeek - offerLastWeek;

    const cityLabel = labels[city] || city || "선택된 지역";
    const dateStr = new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(today);
    const lines = [];
    lines.push(`🧐 ${dateStr} 기준 ${cityLabel} 요약`);
    lines.push(
      `토지거래계약허가 접수: 이번 주 ${mwThisWeek.toLocaleString("ko-KR")}건 · 지난 주 ${mwLastWeek.toLocaleString(
        "ko-KR"
      )}건`
    );
    lines.push(
      `거래량(아파트): 이번 달 ${dealMonthNow.toLocaleString("ko-KR")}건 · 지난 달 ${dealMonthPrev.toLocaleString(
        "ko-KR"
      )}건`
    );
    lines.push(
      `매매 매물: 이번 주 ${offerThisWeek.toLocaleString("ko-KR")}건 · 지난 주 ${offerLastWeek.toLocaleString(
        "ko-KR"
      )}건 · 증감 ${offerDiff >= 0 ? "+" : ""}${offerDiff.toLocaleString("ko-KR")}건`
    );
    return lines;
  }, [labels, city, total, dealTotal, offerTotal, mwPoints, dealPoints, offerSeries]);

  const Spinner = () => (
    <svg className="h-4 w-4 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle className="opacity-20" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  useEffect(() => {
    if (!city || !sggMap[city]) {
      setDealPoints([]);
      setDealError("거래량 데이터가 없는 지역입니다.");
      return;
    }
    let mounted = true;
    setDealLoading(true);
    setDealError("");
    (async () => {
      try {
        const y = new Date().getFullYear();
        const data = await fetchJson(
          `/api/deals?year=${y}&bdsGbn=01&gubun=TRDE&sggCd=${encodeURIComponent(sggMap[city])}`
        );
        if (!mounted) return;
        const row =
          (data.sggList && data.sggList.length && data.sggList[0]) ||
          (data.monthList && data.monthList.length && data.monthList[0]) ||
          null;
        if (!row) {
          setDealPoints([]);
          throw new Error("거래량 데이터가 없습니다.");
        }
        const pts = [];
        for (let i = 1; i <= 12; i++) {
          const key = `a${i}`;
          const raw = row[key] || "0";
          const n = typeof raw === "string" ? parseInt(raw.replace(/,/g, ""), 10) : Number(raw) || 0;
          const mm = String(i).padStart(2, "0");
          pts.push({ date: `${y}-${mm}-01`, count: n });
        }
        setDealPoints(pts);
      } catch (err) {
        if (!mounted) return;
        setDealError(err && err.message ? err.message : String(err));
        setDealPoints([]);
      } finally {
        if (!mounted) return;
        setDealLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [city, sggMap]);

  useEffect(() => {
    if (!city || !sggMap[city]) {
      setOfferSeries({ vm: [], vj: [], vw: [] });
      setOfferError("매물 데이터가 없는 지역입니다.");
      return;
    }
    let mounted = true;
    setOfferLoading(true);
    setOfferError("");
    (async () => {
      try {
        const now = new Date();
        const y = now.getFullYear();
        const url = `/api/offers?area=${encodeURIComponent(
          sggMap[city]
        )}&deal=123&mode=2&sY=${y}&sM=1&eY=${y}&eM=12`;
        const data = await fetchJson(url);
        if (!mounted) return;
        const vm = [];
        (data.points || []).forEach((p) => {
          vm.push({ date: p.date, count: Number(p.vm || 0) || 0 });
        });
        setOfferSeries({ vm, vj: [], vw: [] });
      } catch (err) {
        if (!mounted) return;
        setOfferError(err && err.message ? err.message : String(err));
        setOfferSeries({ vm: [], vj: [], vw: [] });
      } finally {
        if (!mounted) return;
        setOfferLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [city, sggMap]);

  const statusText = useMemo(() => {
    if (loading) return "불러오는 중…";
    if (error) return "오류";
    return "정상";
  }, [loading, error]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">경기 토지거래계약허가 건수</h1>
          <p className="mt-2 text-sm text-slate-600">새올 민원 접수일자를 기준으로 일별 건수를 집계합니다.</p>
          <p className="mt-1 text-xs text-slate-500">😓 과천과 안양은 지원하지 않습니다.</p>
        </div>

        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="text-xs font-medium text-slate-500">지역 선택</div>
            <div className="relative w-full md:w-72">
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={!cities.length}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-9 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              >
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {labels[c] ? labels[c] : c}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.584l3.71-3.354a.75.75 0 111.02 1.1l-4.22 3.81a.75.75 0 01-1.02 0l-4.22-3.81a.75.75 0 01.02-1.1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="text-xs font-medium text-slate-500">상태</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {statusText === "오류" ? (
                  <span className="text-rose-500">{statusText}</span>
                ) : statusText === "불러오는 중…" ? (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Spinner />
                  </div>
                ) : (
                  <span className="text-emerald-600">{statusText}</span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="text-xs font-medium text-slate-500">합계</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {loading ? (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Spinner />
                  </div>
                ) : (
                  total.toLocaleString("ko-KR")
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="text-xs font-medium text-slate-500">업데이트</div>
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-800">
                {loading ? (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Spinner />
                  </div>
                ) : updatedAt ? (
                  new Date(updatedAt).toLocaleString("ko-KR")
                ) : (
                  "-"
                )}
            </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="mb-2 text-sm font-semibold text-slate-800">텍스트 요약</div>
          <div className="space-y-1 text-sm text-slate-700">
            {summaryLines.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <div className="mb-3 text-sm font-medium text-slate-700">
            {labels[city] ? `${labels[city]} 토지거래계약허가 접수 건수` : "토지거래계약허가 접수 건수"}
          </div>
          {mwPoints && mwPoints.length ? (
            <CombinedChart points={mwPoints} />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              데이터가 없습니다.
            </div>
          )}
        </div>

        {Object.keys(sggMap || {}).length ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm font-medium text-slate-700">
                {labels[city] ? `${labels[city]} 부동산 거래량 (아파트, 계약일 기준)` : "부동산 거래량 (아파트, 계약일 기준)"}
              </div>
            </div>
            {dealError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {dealError}
              </div>
            ) : dealPoints && dealPoints.length ? (
              <CombinedChart points={dealPoints} />
            ) : dealLoading ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                불러오는 중…
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                데이터가 없습니다.
              </div>
            )}
          </div>
        ) : null}

        {Object.keys(sggMap || {}).length ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="mb-3 text-sm font-medium text-slate-700">
              {labels[city] ? `${labels[city]} 매매 매물 건수` : "매매 매물 건수"}
            </div>
            {offerError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {offerError}
              </div>
            ) : offerSeries.vm.length ? (
              <StackedChart series={[{ label: "매매", color: "#3b82f6", points: offerSeries.vm }]} />
            ) : offerLoading ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                <Spinner />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                데이터가 없습니다.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
