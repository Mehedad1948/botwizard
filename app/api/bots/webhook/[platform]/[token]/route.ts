import { NextResponse } from "next/server";

import {
  isPlatformSlug,
  platformFromSlug,
} from "@/services/bot-platforms/config";
import { dispatchUserBotUpdate } from "@/services/bot-platforms/dispatch-update";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ platform: string; token: string }> },
) {
  try {
    const { platform, token } = await params;
    if (!isPlatformSlug(platform)) {
      return NextResponse.json(
        { ok: false, error: "Unsupported platform" },
        { status: 404 },
      );
    }

    const result = await dispatchUserBotUpdate(
      platformFromSlug(platform),
      token,
      await request.json(),
    );

    return NextResponse.json(
      result.ok ? { ok: true } : { ok: false, error: result.error },
      { status: result.status },
    );
  } catch (error) {
    console.error("[Bot Webhook Fatal Error]", error);
    return NextResponse.json(
      { ok: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
