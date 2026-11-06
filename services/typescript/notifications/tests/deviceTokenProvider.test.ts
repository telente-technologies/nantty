import { describe, expect, it } from "vitest";

import { registerDeviceTokenBodySchema } from "../src/modules/inbox/validators/inbox.validator.js";

describe("device token provider registration", () => {
  it("defaults existing clients to Expo", () => {
    expect(registerDeviceTokenBodySchema.parse({ token: "ExponentPushToken[legacy-token]", platform: "ios" })).toEqual({
      token: "ExponentPushToken[legacy-token]",
      platform: "ios",
      provider: "expo",
    });
  });

  it("accepts an explicit FCM provider", () => {
    expect(registerDeviceTokenBodySchema.parse({ token: "fcm-registration-token", platform: "android", provider: "fcm" }).provider).toBe("fcm");
  });

  it("rejects provider values outside the configured adapter set", () => {
    expect(() => registerDeviceTokenBodySchema.parse({ token: "valid-length-token", platform: "android", provider: "firebase" })).toThrow();
  });
});
