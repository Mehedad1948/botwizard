import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { runSchedulerTick } from "@/services/publishing/scheduler";

export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  // cron-job.org aborts requests after 30s; the next minute's tick continues.
  const summary = await runSchedulerTick(22_000);
  return NextResponse.json({ ok: true, ...summary });
}

// cron-job.org (scripts/setup-cron-job.mjs) POSTs; GET is kept for manual checks.
export const GET = handle;
export const POST = handle;
