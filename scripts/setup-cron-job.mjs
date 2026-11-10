// Creates or updates the cron-job.org job that calls /api/cron/tick every minute.
// Idempotent: the job is found by title and patched instead of duplicated.
//
//   npm run cron:setup -- https://your-production-domain
//
// Reads CRON_JOB_API_KEY and CRON_SECRET from the environment (.env is loaded
// by the npm script). CRON_SECRET must equal the value configured in the
// production deployment, or every tick is rejected with 401.
const API = "https://api.cron-job.org";
const TITLE = "BotWizard scheduler";

const apiKey = process.env.CRON_JOB_API_KEY;
const secret = process.env.CRON_SECRET;
const baseUrl = (process.argv[2] ?? process.env.CRON_APP_URL ?? "").replace(/\/$/, "");
const disable = process.argv.includes("--disable");

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (!apiKey) fail("CRON_JOB_API_KEY is not set.");
if (!secret || secret.length < 24) fail("CRON_SECRET must be set (at least 24 characters).");
if (!/^https:\/\//.test(baseUrl)) {
  fail("Pass the public production URL, e.g. npm run cron:setup -- https://botwizard.example.com");
}
if (/localhost|127\.0\.0\.1/.test(baseUrl)) fail("cron-job.org cannot reach localhost.");

async function api(method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    const hint = {
      401: "invalid API key",
      403: "API key is IP-restricted and this machine is not allowed",
      429: "rate limit or daily quota (100 requests) reached",
    }[response.status];
    fail(`${method} ${path} → ${response.status}${hint ? ` (${hint})` : ""} ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

const tickUrl = `${baseUrl}/api/cron/tick`;
const job = {
  title: TITLE,
  url: tickUrl,
  enabled: !disable,
  saveResponses: true,
  requestMethod: 1, // POST
  // The tick stops itself after ~25s; free accounts allow up to 30s.
  requestTimeout: 30,
  redirectSuccess: false,
  schedule: {
    timezone: "UTC",
    expiresAt: 0,
    hours: [-1],
    mdays: [-1],
    minutes: [-1],
    months: [-1],
    wdays: [-1],
  },
  extendedData: {
    headers: { Authorization: `Bearer ${secret}` },
    body: "",
  },
  notification: {
    onFailure: true,
    onFailureCount: 5,
    onSuccess: true,
    onDisable: true,
  },
};

const { jobs = [] } = await api("GET", "/jobs");
const existing = jobs.filter((item) => item.title === TITLE);
if (existing.length > 1) {
  fail(`Found ${existing.length} jobs titled "${TITLE}". Delete the extras in the console first.`);
}

if (existing[0]) {
  await api("PATCH", `/jobs/${existing[0].jobId}`, { job });
  console.log(`✔ Updated job ${existing[0].jobId}: POST ${tickUrl} every minute${disable ? " (disabled)" : ""}.`);
} else {
  const { jobId } = await api("PUT", "/jobs", { job });
  console.log(`✔ Created job ${jobId}: POST ${tickUrl} every minute${disable ? " (disabled)" : ""}.`);
}
