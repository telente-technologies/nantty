import { describe, expect, it } from "vitest";

import { readEmailTemplate, renderEmail, renderEmailSample } from "../src/index";

const keys = ["subscriptionTrialEnding", "subscriptionRenewalUpcoming", "subscriptionRenewalReceipt", "subscriptionPaymentFailed", "subscriptionGraceEnding", "subscriptionDowngraded", "subscriptionCardExpiring", "subscriptionPriceChange"] as const;

describe("subscription billing emails", () => {
  it.each(keys)("%s renders in the payments category", async (key) => {
    const rendered = await renderEmailSample(key);
    expect(readEmailTemplate(key).category).toBe("payments");
    expect(rendered.html).toContain("<!DOCTYPE html");
  });

  it("trial reminder states the exact amount, date and a cancel link", async () => {
    const sample = readEmailTemplate("subscriptionTrialEnding").sample;
    const rendered = await renderEmail("subscriptionTrialEnding", { ...sample, daysLeft: 1 }, { locale: "en-NG" });
    expect(rendered.subject).toContain("ends tomorrow");
    expect(rendered.text).toContain("₦5,000");
    expect(rendered.text).toContain("Gold checkmark");
    expect(rendered.html).toContain(sample.cancelUrl);
  });

  it("always shows the checkmark line on plan receipts and explains it", async () => {
    const rendered = await renderEmailSample("subscriptionRenewalReceipt", { locale: "en-NG" });
    expect(rendered.text).toContain("Gold checkmark");
    expect(rendered.text).toContain("₦5,000");
    expect(rendered.text).toContain("charged even while your verification is in review");
  });

  it("shows credits as deductions", async () => {
    const sample = readEmailTemplate("subscriptionRenewalReceipt").sample;
    const rendered = await renderEmail("subscriptionRenewalReceipt", { ...sample, lineItems: [...sample.lineItems, { kind: "proration_credit", label: "Credit from your previous plan", amount: { amountMinor: -100000, currency: "NGN" } }], total: { amountMinor: 400000, currency: "NGN" } }, { locale: "en-NG" });
    expect(rendered.text).toContain("Credit from your previous plan");
    expect(rendered.text).toContain("₦4,000");
  });

  it("payment failed mentions the retry, then the grace period", async () => {
    const sample = readEmailTemplate("subscriptionPaymentFailed").sample;
    const first = await renderEmail("subscriptionPaymentFailed", sample, { locale: "en-NG" });
    expect(first.text).toContain("Next automatic try");
    const grace = await renderEmail("subscriptionPaymentFailed", { ...sample, attempt: 4, retryAt: undefined, graceEndsAt: sample.downgradeAt }, { locale: "en-NG" });
    expect(grace.subject).toContain("Last chance");
    expect(grace.text).not.toContain("Next automatic try");
  });

  it("price change notice is a legal notice with old and new prices", async () => {
    const rendered = await renderEmailSample("subscriptionPriceChange");
    expect(readEmailTemplate("subscriptionPriceChange").consent).toContain("legally required");
    expect(rendered.text).toContain("₦6,000");
    expect(rendered.text).toContain("₦5,000");
  });
});
