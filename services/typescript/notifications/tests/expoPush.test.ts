import { afterEach, describe, expect, it, vi } from "vitest";

import { ExpoPushSender } from "../src/integrations/expoPush.integration.js";

afterEach(() => vi.unstubAllGlobals());

describe("ExpoPushSender", () => {
  it("maps ticket success and errors to token outcomes without retaining provider prose", async () => {
    const tokens = ["ExponentPushToken[valid-one]", "ExponentPushToken[invalid-two]"];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [
      { status: "ok", id: "ticket-1" },
      { status: "error", message: "token must not leak", details: { error: "DeviceNotRegistered" } },
    ] }), { status: 200, headers: { "content-type": "application/json" } })));

    const result = await new ExpoPushSender().send(tokens, { title: "Hi", body: "There" });

    expect(result).toEqual({
      acceptedCount: 1,
      failures: [{ token: tokens[1], classification: "permanent", code: "DeviceNotRegistered" }],
    });
    expect(JSON.stringify(result)).not.toContain("token must not leak");
  });

  it("classifies rate limiting and provider outage as retryable", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(new Response("{}", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const sender = new ExpoPushSender();

    const rateLimited = await sender.send(["token-a"], { title: "Hi", body: "There" });
    const unavailable = await sender.send(["token-b"], { title: "Hi", body: "There" });

    expect(rateLimited.failures).toEqual([{ token: "token-a", classification: "retryable", code: "HTTP_429" }]);
    expect(unavailable.failures).toEqual([{ token: "token-b", classification: "retryable", code: "HTTP_503" }]);
  });

  it("classifies transient and unknown ticket-level errors as retryable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [
      { status: "error", details: { error: "MessageRateExceeded" } },
      { status: "error", details: { error: "NewExpoProviderCode" } },
    ] }), { status: 200 })));

    const result = await new ExpoPushSender().send(["token-a", "token-b"], { title: "Hi", body: "There" });

    expect(result.failures).toEqual([
      { token: "token-a", classification: "retryable", code: "MessageRateExceeded" },
      { token: "token-b", classification: "retryable", code: "UNKNOWN_PROVIDER_ERROR" },
    ]);
  });

  it("classifies request-level client errors as permanent and malformed response as retryable", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ code: "PUSH_TOO_MANY_EXPERIENCE_IDS" }] }), { status: 400 }))
      .mockResolvedValueOnce(new Response("not-json", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const sender = new ExpoPushSender();

    const invalidRequest = await sender.send(["token-a"], { title: "Hi", body: "There" });
    const malformed = await sender.send(["token-b"], { title: "Hi", body: "There" });

    expect(invalidRequest.failures[0]).toMatchObject({ classification: "permanent", code: "PUSH_TOO_MANY_EXPERIENCE_IDS" });
    expect(malformed.failures).toEqual([{ token: "token-b", classification: "retryable", code: "INVALID_TICKET_RESPONSE" }]);
  });

  it("splits requests at Expo's 100-message batch limit and maps each response by index", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: Array.from({ length: 100 }, () => ({ status: "ok" })) }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ status: "error", details: { error: "DeviceNotRegistered" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const tokens = Array.from({ length: 101 }, (_, index) => `token-${index}`);

    const result = await new ExpoPushSender().send(tokens, { title: "Hi", body: "There" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.acceptedCount).toBe(100);
    expect(result.failures).toEqual([{ token: "token-100", classification: "permanent", code: "DeviceNotRegistered" }]);
  });
});
