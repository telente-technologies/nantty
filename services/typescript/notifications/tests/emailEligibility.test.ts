import { describe, expect, it } from "vitest";

import { decideEmailEligibility, type EmailEligibilityInput } from "../src/modules/delivery/services/emailEligibility.service.js";

const base: EmailEligibilityInput = {
  mailKind: "transactional",
  recipient: { email: "a@example.com", emailVerified: true, marketingConsent: false },
  addressVerifiedByFlow: false,
  suppression: null,
  preferenceEmailEnabled: true,
  marketingEmailsSentInWindow: 0,
  marketingMaxPerWindow: 3,
};

const decide = (overrides: Partial<EmailEligibilityInput>) => decideEmailEligibility({ ...base, ...overrides });

describe("marketing consent gating", () => {
  it("blocks marketing without consent", () => {
    expect(decide({ mailKind: "marketing" })).toEqual({ allowed: false, reason: "no_marketing_consent" });
  });

  it("allows marketing with consent under the frequency cap", () => {
    expect(decide({ mailKind: "marketing", recipient: { ...base.recipient, marketingConsent: true }, marketingEmailsSentInWindow: 2 })).toEqual({ allowed: true });
  });

  it("blocks marketing at the frequency cap", () => {
    expect(decide({ mailKind: "marketing", recipient: { ...base.recipient, marketingConsent: true }, marketingEmailsSentInWindow: 3 })).toEqual({ allowed: false, reason: "frequency_cap" });
  });

  it("blocks marketing when the user turned the email preference off", () => {
    expect(decide({ mailKind: "marketing", recipient: { ...base.recipient, marketingConsent: true }, preferenceEmailEnabled: false })).toEqual({ allowed: false, reason: "preference_disabled" });
  });

  it("does not apply marketing rules to transactional email", () => {
    expect(decide({ marketingEmailsSentInWindow: 99 })).toEqual({ allowed: true });
  });
});

describe("suppression", () => {
  it("never sends to a hard-bounced address, whatever the kind", () => {
    for (const mailKind of ["transactional", "security", "legal", "marketing"] as const) {
      expect(decide({ mailKind, suppression: "hard_bounce", recipient: { ...base.recipient, marketingConsent: true } })).toEqual({ allowed: false, reason: "suppressed_hard_bounce" });
    }
  });

  it("a complaint blocks marketing only", () => {
    expect(decide({ mailKind: "marketing", suppression: "complaint", recipient: { ...base.recipient, marketingConsent: true } })).toEqual({ allowed: false, reason: "suppressed_complaint" });
    expect(decide({ mailKind: "legal", suppression: "complaint" })).toEqual({ allowed: true });
    expect(decide({ mailKind: "transactional", suppression: "complaint" })).toEqual({ allowed: true });
  });
});

describe("legal and security mail", () => {
  it("ignores marketing consent and the preference toggle", () => {
    expect(decide({ mailKind: "legal", preferenceEmailEnabled: false })).toEqual({ allowed: true });
    expect(decide({ mailKind: "security", preferenceEmailEnabled: false })).toEqual({ allowed: true });
  });

  it("needs a verified address unless the flow verifies it", () => {
    expect(decide({ recipient: { ...base.recipient, emailVerified: false } })).toEqual({ allowed: false, reason: "email_not_verified" });
    expect(decide({ recipient: { ...base.recipient, emailVerified: false }, addressVerifiedByFlow: true })).toEqual({ allowed: true });
    expect(decide({ recipient: { ...base.recipient, email: null } })).toEqual({ allowed: false, reason: "no_email_on_account" });
  });
});
