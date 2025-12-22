# MW Daily Dashboard (Vercel)

Next.js app that visualizes daily counts of `토지거래계약허가` 민원 (일별 건수 막대 차트).

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

## Endpoints

- `GET /api/cities` – supported cities
- `GET /api/daily?city=yongin` – reads today’s Blob JSON; if that city is missing, triggers a full re-crawl for that city
- `GET /api/refresh-city?city=yongin` – force refresh for that city (optional)

## Local dev

```bash
npm install
npm run dev
```

You must provide Postgres env vars locally if you want the APIs to work.
