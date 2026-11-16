import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createSignedWebhookEnvelope, isPublicAddress, parseWebhookUrl, resolvePublicWebhookTarget, safeWebhookErrorCode, WebhookDeliveryError, WebhookTargetError } from "../src/webhookSecurity.js";

describe("sandbox webhook destination security", () => {
  it.each([
    "http://example.com/hook",
    "https://user:pass@example.com/hook",
    "https://example.com:8443/hook",
    "https://example.com/hook#fragment",
  ])("rejects unsupported or local destination %s", (value) => {
    expect(() => parseWebhookUrl(value)).toThrow(WebhookTargetError);
  });

  it.each(["https://localhost/hook", "https://api.localhost/hook", "https://service.internal/hook", "https://192.168.1.8/hook"])("rejects local destination before DNS lookup: %s", async (value) => {
    let wasResolved = false;
    await expect(resolvePublicWebhookTarget(value, async () => { wasResolved = true; return [{ address: "93.184.216.34", family: 4 }]; })).rejects.toMatchObject({ code: "WEBHOOK_HOST_NOT_PUBLIC" });
    expect(wasResolved).toBe(false);
  });

  it("allows only HTTPS on the default TLS port and retains path and query", () => {
    const target = parseWebhookUrl("https://hooks.example.org/v1/events?source=nantty");
    expect(target.protocol).toBe("https:");
    expect(target.port).toBe("");
    expect(target.pathname).toBe("/v1/events");
    expect(target.search).toBe("?source=nantty");
  });

  it("resolves and pins a public DNS answer without accepting mixed public/private answers", async () => {
    const target = await resolvePublicWebhookTarget("https://hooks.example.org/events", async (hostname) => {
      expect(hostname).toBe("hooks.example.org");
      return [{ address: "93.184.216.34", family: 4 }];
    });
    expect(target).toMatchObject({ hostname: "hooks.example.org", address: "93.184.216.34", family: 4 });

    await expect(resolvePublicWebhookTarget("https://hooks.example.org/events", async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.4", family: 4 },
    ])).rejects.toMatchObject({ code: "WEBHOOK_HOST_NOT_PUBLIC" });
  });

  it("rejects DNS answers that are empty, malformed, private, loopback, link-local, reserved, or non-global IPv6", async () => {
    for (const records of [
      [],
      [{ address: "not-an-ip", family: 4 }],
      [{ address: "127.0.0.1", family: 4 }],
      [{ address: "169.254.169.254", family: 4 }],
      [{ address: "100.64.0.1", family: 4 }],
      [{ address: "198.18.0.1", family: 4 }],
      [{ address: "224.0.0.1", family: 4 }],
      [{ address: "::1", family: 6 }],
      [{ address: "fe80::1", family: 6 }],
      [{ address: "fc00::1", family: 6 }],
      [{ address: "2001:db8::1", family: 6 }],
      [{ address: "::ffff:7f00:1", family: 6 }],
    ]) {
      await expect(resolvePublicWebhookTarget("https://hooks.example.org/events", async () => records)).rejects.toMatchObject({ code: "WEBHOOK_HOST_NOT_PUBLIC" });
    }
  });

  it("classifies selected public and non-public address ranges", () => {
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
    expect(isPublicAddress("192.0.2.1")).toBe(false);
    expect(isPublicAddress("203.0.113.1")).toBe(false);
    expect(isPublicAddress("2001:db8::2")).toBe(false);
  });

  it("returns stable non-sensitive error codes", () => {
    expect(safeWebhookErrorCode(new WebhookTargetError("WEBHOOK_URL_INVALID"))).toBe("WEBHOOK_URL_INVALID");
    expect(safeWebhookErrorCode(new Error("private resolver detail"))).toBe("ENDPOINT_UNREACHABLE");
  });

  it("signs the exact stable event envelope and enforces the payload size limit", () => {
    const input = { secret: "whsec_test_secret", eventId: "event-123", event: "message.received", createdAt: "2026-11-16T00:00:00.000Z", data: { conversationId: "sandbox-conversation" }, timestampSeconds: 1_800_000_000 };
    const signed = createSignedWebhookEnvelope(input);
    const expectedDigest = createHmac("sha256", input.secret).update(`${signed.timestamp}.${signed.body}`).digest("hex");
    expect(signed.signature).toBe(`t=${signed.timestamp},v1=${expectedDigest}`);
    expect(JSON.parse(signed.body)).toEqual({ id: input.eventId, event: input.event, createdAt: input.createdAt, data: input.data });
    expect(createSignedWebhookEnvelope(input)).toEqual(signed);
    expect(() => createSignedWebhookEnvelope({ ...input, data: { content: "x".repeat(33_000) } })).toThrow(WebhookDeliveryError);
  });
});
