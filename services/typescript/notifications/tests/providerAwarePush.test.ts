import { describe, expect, it, vi } from "vitest";

import { ProviderAwarePushSender } from "../src/integrations/providerAwarePush.integration.js";
import type { PushSender } from "../src/interfaces/pushSender.interface.js";

const successfulSender: PushSender = {
  async send(tokens) { return { acceptedCount: tokens.length, failures: [] }; },
  async sendSilent(tokens) { return { acceptedCount: tokens.length, failures: [] }; },
};

describe("ProviderAwarePushSender", () => {
  it("keeps log as a non-delivery default and does not invoke external senders", async () => {
    const info = vi.fn();
    const logger = { info } as never;
    const expo = { send: vi.fn(successfulSender.send), sendSilent: vi.fn(successfulSender.sendSilent) } as PushSender;
    const sender = new ProviderAwarePushSender("log", expo, successfulSender, logger);

    const result = await sender.send(["secret-token"], { title: "Test", body: "Only log" }, "fcm");

    expect(result).toEqual({ acceptedCount: 0, failures: [], simulated: true });
    expect(expo.send).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith("push notification (log adapter)", { recipients: 1, provider: "fcm", title: "Test" });
    expect(JSON.stringify(info.mock.calls)).not.toContain("secret-token");
  });

  it("routes by provider when multi-provider delivery is enabled", async () => {
    const expo = { send: vi.fn(successfulSender.send), sendSilent: vi.fn(successfulSender.sendSilent) } as PushSender;
    const fcm = { send: vi.fn(successfulSender.send), sendSilent: vi.fn(successfulSender.sendSilent) } as PushSender;
    const sender = new ProviderAwarePushSender("multi", expo, fcm, {} as never);

    await sender.send(["expo-token"], { title: "Hi", body: "There" }, "expo");
    await sender.send(["fcm-token"], { title: "Hi", body: "There" }, "fcm");

    expect(expo.send).toHaveBeenCalledOnce();
    expect(fcm.send).toHaveBeenCalledOnce();
  });

  it("refuses FCM tokens when only the Expo provider is enabled", async () => {
    const sender = new ProviderAwarePushSender("expo", successfulSender, null, {} as never);

    const result = await sender.send(["fcm-token"], { title: "Hi", body: "There" }, "fcm");

    expect(result.failures).toEqual([{ token: "fcm-token", classification: "permanent", code: "PROVIDER_DISABLED" }]);
  });
});
