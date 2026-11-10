/**
 * Database-backed scheduler tests. Run against a disposable database only:
 *   TEST_DATABASE_URL=postgresql://... npx vitest run tests/scheduler.int.test.ts
 * The Prisma client is constructed from TEST_DATABASE_URL explicitly, never
 * from DATABASE_URL/.env.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return {
    default: new PrismaClient({
      datasourceUrl: process.env.TEST_DATABASE_URL ?? "postgresql://invalid:1/none",
    }),
  };
});

const sent: { method: string; chatId: unknown }[] = [];
vi.mock("@/services/bot-platforms/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/bot-platforms/provider")>();
  const fake = {
    platform: "TELEGRAM",
    slug: "telegram",
    call: async (_token: string, method: string, payload: Record<string, unknown>) => {
      sent.push({ method, chatId: payload.chat_id });
      if (payload.chat_id === "-2002") {
        return { ok: false, error_code: 403, description: "Forbidden: bot was kicked from the group chat" };
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { ok: true, result: { message_id: 77 } };
    },
  };
  return { ...actual, getBotPlatformProvider: () => fake };
});

import prisma from "@/lib/prisma";
import { createCampaign, setCampaignPaused } from "@/services/publishing/campaigns";
import { runSchedulerTick, sendCampaignNow } from "@/services/publishing/scheduler";

describe.skipIf(!TEST_DATABASE_URL)("scheduler (database)", () => {
  const botId = "it_bot";

  beforeAll(async () => {
    await prisma.bot.deleteMany({ where: { id: { in: [botId, "it_other"] } } });
    await prisma.user.upsert({
      where: { id: "it_user" },
      create: { id: "it_user" },
      update: {},
    });
    await prisma.bot.create({
      data: {
        id: botId,
        userId: "it_user",
        token: "999:it",
        username: "itbot",
        ownerPlatformUserId: "1",
        posts: { create: { id: "it_post", content: "سلام", entities: [] } },
        connectedChats: {
          create: [
            { id: "it_ok", chatId: "-2001", chatTitle: "OK" },
            { id: "it_kicked", chatId: "-2002", chatTitle: "Kicked" },
          ],
        },
      },
    });
    await prisma.bot.create({
      data: {
        id: "it_other",
        userId: "it_user",
        token: "998:it",
        username: "other",
        connectedChats: { create: { id: "it_foreign", chatId: "-3001", chatTitle: "Foreign" } },
      },
    });
  });

  it("rejects destinations of another bot", async () => {
    const result = await createCampaign(botId, {
      postId: "it_post",
      destinationIds: ["it_ok", "it_foreign"],
      scheduleKind: "DAILY",
      times: ["09:00"],
    });
    expect(result.ok).toBe(false);
  });

  it("delivers a due occurrence once per destination under concurrent ticks", async () => {
    const created = await createCampaign(botId, {
      postId: "it_post",
      destinationIds: ["it_ok", "it_kicked"],
      scheduleKind: "INTERVAL",
      intervalMinutes: 120,
    });
    expect(created.ok).toBe(true);
    const id = created.ok ? created.value.id : "";

    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id } });
    expect(campaign.nextRun!.getTime()).toBeLessThanOrEqual(Date.now());

    sent.length = 0;
    await Promise.all([runSchedulerTick(15_000), runSchedulerTick(15_000), runSchedulerTick(15_000)]);

    const deliveries = await prisma.delivery.findMany({ where: { campaignId: id } });
    expect(deliveries).toHaveLength(2);
    expect(sent.filter((call) => call.chatId === "-2001")).toHaveLength(1);
    expect(deliveries.find((row) => row.chatId === "-2001")).toMatchObject({ status: "SENT", providerMessageId: "77" });
    expect(deliveries.find((row) => row.chatId === "-2002")).toMatchObject({ status: "FAILED", errorKind: "REMOVED" });

    const kicked = await prisma.connectedChat.findUniqueOrThrow({ where: { id: "it_kicked" } });
    expect(kicked.status).toBe("REMOVED");

    const advanced = await prisma.campaign.findUniqueOrThrow({ where: { id } });
    expect(advanced.runCount).toBe(1);
    expect(advanced.nextRun!.getTime()).toBeGreaterThan(Date.now() + 110 * 60_000);

    // The removed destination is skipped on the next manual run.
    const summary = await sendCampaignNow(id);
    expect(summary).toMatchObject({ sent: 1, skipped: 1, failed: 0 });
  });

  it("completes one-off campaigns and resumes paused ones without replay", async () => {
    await prisma.connectedChat.update({ where: { id: "it_kicked" }, data: { status: "ACTIVE" } });
    const once = await createCampaign(botId, {
      postId: "it_post",
      destinationIds: ["it_ok"],
      scheduleKind: "ONCE",
    });
    const id = once.ok ? once.value.id : "";
    await runSchedulerTick(15_000);
    const done = await prisma.campaign.findUniqueOrThrow({ where: { id } });
    expect(done).toMatchObject({ status: "COMPLETED", nextRun: null, runCount: 1 });

    const daily = await createCampaign(botId, {
      postId: "it_post",
      destinationIds: ["it_ok"],
      scheduleKind: "DAILY",
      times: ["00:00"],
    });
    const dailyId = daily.ok ? daily.value.id : "";
    await setCampaignPaused(botId, dailyId, true);
    await prisma.campaign.update({ where: { id: dailyId }, data: { nextRun: new Date(Date.now() - 86_400_000) } });
    await runSchedulerTick(15_000);
    expect(await prisma.delivery.count({ where: { campaignId: dailyId } })).toBe(0);

    await setCampaignPaused(botId, dailyId, false);
    const resumed = await prisma.campaign.findUniqueOrThrow({ where: { id: dailyId } });
    expect(resumed.status).toBe("ACTIVE");
    expect(resumed.nextRun!.getTime()).toBeGreaterThan(Date.now());
  });
});
