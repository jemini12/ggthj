# MW Daily Dashboard (Vercel)

Next.js app that visualizes:
- `토지거래계약허가` 민원 일별·누적 건수 (시작일: 2025-10-20)
- 경기 부동산 거래량(아파트, 월별 계약 건수)
- 매매 매물 건수(연도별, 매물 누적값 일자 단위)
All data is pulled lazily per-city and cached in Vercel Blob (deals/offers are cached in-memory for 12h).

## Deploy (Vercel)

1. Create a Vercel Blob store and connect it to this project (so `BLOB_READ_WRITE_TOKEN` is set).
2. (Recommended) Set secrets:
   - `CRON_SECRET`: protect manual refresh endpoint
   - `ADMIN_SECRET`: protect backfill endpoint
3. Deploy.

Notes:
- The cron endpoint uses a hard 10s timeout per upstream request (per your constraint), plus small retries/backoff.
- Blob output is written per-day as `mw-daily-YYYY-MM-DD.json`.
- The dashboard uses today’s blob; if the requested city is missing, it re-crawls the full range for that city and writes today’s blob, otherwise it just reads.
- Routes are `/` and `/{city}` (e.g., `/gwangmyeong`). A city must be selected before charts render.
- Supported cities live in `data/cities.json` (includes sgg codes and department filters). 과천/안양 are intentionally unsupported.

## Endpoints

- `GET /api/cities` – supported cities
- `GET /api/daily?city=yongin` – reads today’s Blob JSON; if that city is missing, triggers a full re-crawl for that city
- `GET /api/deals?year=2025&bdsGbn=01&gubun=TRDE&sggCd=41135` – monthly apartment 거래량 (cached 12h)
- `GET /api/offers?area=41135&deal=123&mode=2&sY=2025&sM=1&eY=2025&eM=12` – 매매 매물 추이 (current year, cached 12h)
- `GET /api/refresh-city?city=yongin` – force refresh for that city (optional)

## Local dev

```bash
npm install
npm run dev
```

Env needed locally:
- `BLOB_READ_WRITE_TOKEN` for Vercel Blob
- Optional: `CRON_SECRET`, `ADMIN_SECRET` if you want to protect refresh endpoints.

Node version: Next 16.x requires Node 20. Install via nvm (`nvm use` with the provided `.nvmrc`) or upgrade your local runtime before building.
