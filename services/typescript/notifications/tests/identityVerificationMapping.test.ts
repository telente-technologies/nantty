import { describe, expect, it } from "vitest";

import { verificationEligible, verificationRejectedRefunded } from "../src/modules/eventIngestion/mappings/identityVerification.mapping.js";
import { EventDataReader } from "../src/utils/eventDataReader.util.js";
import { makeEvent } from "./fakes/testHarness.fake.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";

const context = { webBaseUrl: "https://zudomart.com", sellerDashboardUrl: "https://dashboard.zudomart.com" };

describe("identity verification notifications", () => {
  it("tells a queued applicant they can now apply, with a deep link to pay", () => {
    const data = { accountId: "u1", checkmark: "blue", accountName: "@amaka", deepLink: "https://zudomart.com/settings/verification?step=pay" };
    const [intent] = verificationEligible(makeEvent("verification.eligible", data), new EventDataReader(data), context);
    expect(intent?.inApp?.title).toBe("You can now apply for verification");
    expect(intent?.push?.data).toMatchObject({ url: data.deepLink, screen: "Verification" });
    expect(intent?.email?.(makeRecipient({ accountId: "u1" })).props).toMatchObject({ payUrl: data.deepLink, checkmark: "Blue" });
  });

  it("explains the refund route for each payment channel", () => {
    for (const [refundMethod, phrase] of [["card", "being refunded"], ["apple_request", "from Apple"], ["plan_continues", "try again"]] as const) {
      const data = { accountId: "u1", checkmark: "gold", accountName: "Adire", caseId: "c1", reasons: ["Name mismatch"], refundMethod, reapplyFrom: "2026-11-03T00:00:00.000Z" };
      const [intent] = verificationRejectedRefunded(makeEvent("verification.rejectedRefunded", data), new EventDataReader(data), context);
      expect(intent?.push?.body).toContain(phrase);
      expect(intent?.email?.(makeRecipient({ accountId: "u1" })).props).toMatchObject({ refundMethod });
    }
  });

  it("says the plan stays active and how much was refunded for the checkmark", () => {
    const data = { accountId: "u1", checkmark: "gold", accountName: "Adire", caseId: "c1", reasons: ["Name mismatch"], refundMethod: "plan_share_card", refundAmount: { amountMinor: 300000, currency: "NGN" }, reapplyFrom: "2026-11-03T00:00:00.000Z" };
    const [intent] = verificationRejectedRefunded(makeEvent("verification.rejectedRefunded", data), new EventDataReader(data), context);
    expect(intent?.push?.body).toContain("Your plan stays active");
    expect(intent?.push?.body).toContain("for the checkmark");
    expect(intent?.email?.(makeRecipient({ accountId: "u1" })).props).toMatchObject({ refundMethod: "plan_share_card", refundAmount: { amountMinor: 300000, currency: "NGN" } });
  });

  it("falls back to the card wording for an unknown refund method", () => {
    const data = { accountId: "u1", checkmark: "blue", accountName: "@a", reasons: [], refundMethod: "weird", reapplyFrom: "2026-11-03T00:00:00.000Z" };
    const [intent] = verificationRejectedRefunded(makeEvent("verification.rejectedRefunded", data), new EventDataReader(data), context);
    expect(intent?.email?.(makeRecipient({ accountId: "u1" })).props).toMatchObject({ refundMethod: "card" });
  });
});
