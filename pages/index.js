import { useEffect, useMemo, useState } from "react";
import CombinedChart from "../components/CombinedChart";

export async function getServerSideProps() {
  try {
    const cfg = require("../data/cities.json");
    const cities = cfg.map((c) => c.code);
    const labels = cfg.reduce((acc, c) => {
      acc[c.code] = c.label;
      return acc;
    }, {});
    return { props: { initialCities: cities, initialLabels: labels } };
  } catch (err) {
    return { props: { initialCities: [], initialLabels: {} } };
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

export default function Home({ initialCities = [], initialLabels = {} }) {
  const [cities, setCities] = useState(initialCities);
  const [labels, setLabels] = useState(initialLabels);
  const [city, setCity] = useState(initialCities.includes("yongin") ? "yongin" : initialCities[0] || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [points, setPoints] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    let mounted = true;
    fetchJson("/api/cities")
      .then((data) => {
        if (!mounted) return;
        const list = data.cities || [];
        setLabels(data.labels || {});
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

  const total = useMemo(() => {
    return (points || []).reduce((acc, p) => acc + (p.count || 0), 0);
  }, [points]);

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
          <p className="mt-1 text-xs text-slate-500">과천과 안양은 지원하지 않습니다.</p>
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
                  <span className="text-slate-600">{statusText}</span>
                ) : (
                  <span className="text-emerald-600">{statusText}</span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="text-xs font-medium text-slate-500">합계</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {loading ? "불러오는 중…" : total.toLocaleString("ko-KR")}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="text-xs font-medium text-slate-500">업데이트</div>
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-800">
                {loading ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin text-blue-500"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle className="opacity-20" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span className="text-slate-600">불러오는 중…</span>
                  </>
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

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <div className="mb-3 text-sm font-medium text-slate-700">일별 + 누적 그래프</div>
          {points && points.length ? (
            <CombinedChart points={points} />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              데이터가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
