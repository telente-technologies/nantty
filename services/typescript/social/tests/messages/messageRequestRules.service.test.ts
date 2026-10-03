import { describe, expect, it } from "vitest";

import { decideMessageRouting, isRequestVisibleToRecipient } from "../../src/modules/conversations/services/messageRequestRules.service.js";

const stranger = { audience: "everyone", recipientFollowsSender: false, senderFollowsRecipient: false, blockedEitherWay: false, senderFlaggedAsSpam: false } as const;

describe("decideMessageRouting", () => {
  it("sends strangers to requests when everyone may message", () => {
    expect(decideMessageRouting(stranger)).toEqual({ kind: "deliver", folder: "requests" });
  });
  it("trusts people the recipient follows", () => {
    expect(decideMessageRouting({ ...stranger, audience: "nobody", recipientFollowsSender: true })).toEqual({ kind: "deliver", folder: "chats" });
  });
  it("enforces following, followers and nobody audiences", () => {
    expect(decideMessageRouting({ ...stranger, audience: "following" })).toEqual({ kind: "refused", reason: "REQUESTS_CLOSED" });
    expect(decideMessageRouting({ ...stranger, audience: "followers" })).toEqual({ kind: "refused", reason: "REQUESTS_CLOSED" });
    expect(decideMessageRouting({ ...stranger, audience: "followers", senderFollowsRecipient: true })).toEqual({ kind: "deliver", folder: "requests" });
    expect(decideMessageRouting({ ...stranger, audience: "nobody" })).toEqual({ kind: "refused", reason: "REQUESTS_CLOSED" });
  });
  it("moves flagged senders to spam but never trusted ones", () => {
    expect(decideMessageRouting({ ...stranger, senderFlaggedAsSpam: true })).toEqual({ kind: "deliver", folder: "spam" });
    expect(decideMessageRouting({ ...stranger, senderFlaggedAsSpam: true, recipientFollowsSender: true })).toEqual({ kind: "deliver", folder: "chats" });
  });
  it("refuses blocked pairs", () => {
    expect(decideMessageRouting({ ...stranger, blockedEitherWay: true, recipientFollowsSender: true })).toEqual({ kind: "refused", reason: "BLOCKED" });
  });
});

describe("isRequestVisibleToRecipient", () => {
  it("hides requests outside the current audience", () => {
    expect(isRequestVisibleToRecipient("nobody", false, false)).toBe(false);
    expect(isRequestVisibleToRecipient("followers", false, true)).toBe(true);
    expect(isRequestVisibleToRecipient("following", true, false)).toBe(true);
  });
});
