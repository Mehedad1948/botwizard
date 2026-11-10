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
  const summary = await runSchedulerTick(45_000);
  return NextResponse.json({ ok: true, ...summary });
}

// Vercel Cron issues GET requests; external schedulers may POST.
export const GET = handle;
export const POST = handle;
