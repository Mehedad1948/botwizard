// Calls the scheduler tick every minute. Use it in development, or on a VPS
// where the platform has no per-minute cron:
//   APP_URL=https://your-app CRON_SECRET=... node scripts/scheduler.mjs
const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.CRON_SECRET;
const intervalMs = Number(process.env.SCHEDULER_INTERVAL_MS ?? 60_000);

if (!secret) {
  console.error("CRON_SECRET is required.");
  process.exit(1);
}

async function tick() {
  const started = Date.now();
  try {
    const response = await fetch(`${appUrl}/api/cron/tick`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = await response.json().catch(() => ({}));
    console.log(new Date().toISOString(), response.status, JSON.stringify(body));
  } catch (error) {
    console.error(new Date().toISOString(), "tick failed:", error.message);
  }
  setTimeout(tick, Math.max(1_000, intervalMs - (Date.now() - started)));
}

tick();
