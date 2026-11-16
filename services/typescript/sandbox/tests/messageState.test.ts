import { describe, expect, it } from "vitest";

import { resolveSandboxMessageTransition } from "../src/messageState.js";

describe("sandbox message state transitions", () => {
  it.each([
    ["sent", "delivered", "message.delivered"],
    ["sent", "failed", "message.failed"],
    ["delivered", "read", "message.read"],
  ] as const)("allows %s -> %s", (current, target, eventType) => {
    expect(resolveSandboxMessageTransition("business", current, target)).toEqual({ status: target, eventType });
  });

  it("treats a repeated transition as idempotent without emitting another event", () => {
    expect(resolveSandboxMessageTransition("business", "delivered", "delivered")).toEqual({ status: "delivered", eventType: null });
  });

  it.each([
    ["sent", "read"],
    ["read", "failed"],
    ["failed", "delivered"],
    ["received", "delivered"],
  ] as const)("rejects %s -> %s", (current, target) => {
    expect(resolveSandboxMessageTransition("business", current, target)).toBeNull();
  });

  it("does not let customer messages use outbound delivery transitions", () => {
    expect(resolveSandboxMessageTransition("customer", "received", "read")).toBeNull();
  });
});
