import { describe, expect, it } from "vitest";

import {
  createDispatchKey,
  createOccurrenceKey,
  sanitizeDispatchError,
} from "@/services/audience-notifications/dispatch";
import {
  parseStartParameter,
  parseSubscriberCallback,
} from "@/services/audience-notifications/types";
import { normalizeTopicSlug } from "@/services/audience-notifications/topics";
import { classifyProviderError } from "@/services/bot-platforms/provider";

describe("subscriber callback parsing", () => {
  it("accepts only the allowlisted callback shapes", () => {
    expect(parseSubscriberCallback("topic:list")).toEqual({ type: "LIST" });
    expect(parseSubscriberCallback("topic:stop")).toEqual({ type: "STOP" });
    expect(parseSubscriberCallback("topic:toggle:Abc_123")).toEqual({
      type: "TOGGLE",
      callbackKey: "Abc_123",
    });
    expect(parseSubscriberCallback("topic:toggle:../../bot")).toBeNull();
    expect(parseSubscriberCallback("topic:toggle:short")).toBeNull();
    expect(parseSubscriberCallback("campaign:delete:1")).toBeNull();
  });

  it("parses bounded Telegram start parameters", () => {
    expect(parseStartParameter("/start offer_BMW")).toBe("offer_BMW");
    expect(parseStartParameter("/start@sample_bot ref-12")).toBe("ref-12");
    expect(parseStartParameter("/start invalid value")).toBeNull();
    expect(parseStartParameter(`/start ${"a".repeat(65)}`)).toBeNull();
  });
});

describe("topic normalization", () => {
  it("creates stable bot-scoped slugs from Persian and Latin names", () => {
    expect(normalizeTopicSlug("  New   Arrivals ")).toBe("new-arrivals");
    expect(normalizeTopicSlug("خودرو برقی")).toBe("خودرو-برقی");
    expect(normalizeTopicSlug("SUV / Electric")).toBe("suv-electric");
  });
});

describe("provider error classification", () => {
  it("classifies blocked and rate-limited responses", () => {
    expect(
      classifyProviderError({
        ok: false,
        error_code: 403,
        description: "Forbidden: bot was blocked by the user",
      }),
    ).toMatchObject({ ok: false, kind: "BLOCKED" });

    expect(
      classifyProviderError({
        ok: false,
        error_code: 429,
        description: "Too Many Requests",
        parameters: { retry_after: 4 },
      }),
    ).toMatchObject({
      ok: false,
      kind: "RATE_LIMITED",
      retryAfterSeconds: 4,
    });
  });
});

describe("dispatch idempotency", () => {
  it("produces stable keys within an occurrence and distinct recurring keys", () => {
    const base = {
      audienceKey: "audience-1",
      postId: "post-1",
      subscriberId: "subscriber-1",
    };
    const first = createDispatchKey({
      ...base,
      occurrenceKey: "scheduled:2026-06-13T10:00:00.000Z",
    });
    expect(
      createDispatchKey({
        ...base,
        occurrenceKey: "scheduled:2026-06-13T10:00:00.000Z",
      }),
    ).toBe(first);
    expect(
      createDispatchKey({
        ...base,
        occurrenceKey: "scheduled:2026-06-14T10:00:00.000Z",
      }),
    ).not.toBe(first);
  });

  it("uses explicit operation and scheduled occurrence identities", () => {
    expect(createOccurrenceKey({ operationId: "manual-1" })).toBe(
      "manual:manual-1",
    );
    expect(
      createOccurrenceKey({
        scheduledFor: new Date("2026-06-13T10:00:00.000Z"),
      }),
    ).toBe("scheduled:2026-06-13T10:00:00.000Z");
  });

  it("redacts provider credentials and bounds stored errors", () => {
    const sanitized = sanitizeDispatchError(
      `authorization: secret bot123456:ABC_token ${"x".repeat(1500)}`,
    );
    expect(sanitized).not.toContain("ABC_token");
    expect(sanitized).not.toContain("authorization: secret");
    expect(sanitized.length).toBeLessThanOrEqual(1000);
  });
});
