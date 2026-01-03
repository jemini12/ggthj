const { fetchDailyCount, toYmd } = require("./lib/eminwon");
const cities = require("./data/cities.json");

async function sampleData(cityCode, daysBack = 7) {
    const cityCfg = cities.find((c) => c.code === cityCode);
    if (!cityCfg) {
        console.error("City not found:", cityCode);
        return;
    }

    const now = new Date();
    const results = [];

    for (let i = 0; i < daysBack; i++) {
        const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        console.log(`Fetching data for ${cityCfg.label} on ${toYmd(day)}...`);
        try {
            const result = await fetchDailyCount({
                baseUrl: cityCfg.baseUrl,
                cityCfg,
                day,
                timeoutMs: 10000,
            });
            results.push({ date: toYmd(day), ...result });
        } catch (err) {
            console.error(`Failed for ${toYmd(day)}:`, err.message);
        }
    }

    console.log("\n--- Analysis Result ---");
    console.log(`City: ${cityCfg.label}`);
    console.log(`Keyword: 토지거래계약허가`);
    console.log("------------------------");
    results.sort((a, b) => a.date.localeCompare(b.date));

    const globalStatus = {};

    results.forEach((r) => {
        console.log(`${r.date}: ${r.count} cases`);
        if (r.statusCounts) {
            Object.entries(r.statusCounts).forEach(([s, c]) => {
                globalStatus[s] = (globalStatus[s] || 0) + c;
            });
        }
    });

    const total = results.reduce((acc, r) => acc + r.count, 0);
    const avg = (total / results.length).toFixed(2);
    console.log("------------------------");
    console.log(`Total (last ${results.length} days): ${total}`);
    console.log(`Average daily: ${avg}`);
    console.log("Status Breakdown (Total in HTML):");
    Object.entries(globalStatus).forEach(([s, c]) => {
        console.log(` - ${s}: ${c}`);
    });
}

const city = process.argv[2] || "gwangmyeong";
sampleData(city);
