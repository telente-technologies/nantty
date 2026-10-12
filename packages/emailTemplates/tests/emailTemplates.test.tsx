import { describe, expect, it } from "vitest";

import { emailTemplateKeys, formatMoney, listEmailTemplateCatalogue, readEmailBrandFromEnvironment, readEmailTemplate, renderEmail, renderEmailSample } from "../src/index";

const catalogue = listEmailTemplateCatalogue();
const marketingKeys = catalogue.filter((entry) => entry.kind === "marketing").map((entry) => entry.key);
const otherKeys = catalogue.filter((entry) => entry.kind !== "marketing").map((entry) => entry.key);

describe("email template catalogue", () => {
  it("registers every template under its own key", () => {
    for (const key of emailTemplateKeys) expect(readEmailTemplate(key).key).toBe(key);
    expect(emailTemplateKeys.length).toBeGreaterThanOrEqual(80);
  });

  it("has marketing templates only in the marketing category", () => {
    expect(marketingKeys.length).toBeGreaterThan(0);
    for (const entry of catalogue) expect(entry.kind === "marketing").toBe(entry.category === "marketing");
  });
});

describe.each(emailTemplateKeys)("%s", (key) => {
  it("renders html, text and subject in light and dark", async () => {
    for (const theme of ["auto", "dark"] as const) {
      const rendered = await renderEmailSample(key, { theme });
      expect(rendered.subject.length).toBeGreaterThan(5);
      expect(rendered.html).toContain("<!DOCTYPE html");
      expect(rendered.html).toContain('name="color-scheme"');
      expect(rendered.html).toContain("ZUDOMART_COMPANY_LEGAL_NAME");
      expect(rendered.html).toContain("ZUDOMART_COMPANY_ADDRESS");
      expect(rendered.html).toContain("support@zudomart.com");
      expect(rendered.html).not.toContain("icloud.com");
      expect(rendered.html).toContain('alt="Download on the App Store"');
      expect(rendered.html).toContain('alt="Get it on Google Play"');
      expect(rendered.html).not.toContain("<script");
      expect(rendered.text).toContain("ZUDOMART_COMPANY_ADDRESS");
    }
  });
});

describe("footer links", () => {
  it.each(marketingKeys)("%s includes unsubscribe", async (key) => {
    const rendered = await renderEmailSample(key, { links: { unsubscribeUrl: "https://zudomart.com/u/token-123" } });
    expect(rendered.html).toContain("https://zudomart.com/u/token-123");
    expect(rendered.html).toContain("Unsubscribe");
    expect(rendered.text).toContain("Unsubscribe: https://zudomart.com/u/token-123");
  });

  it.each(otherKeys)("%s has manage notifications and no unsubscribe", async (key) => {
    const rendered = await renderEmailSample(key);
    expect(rendered.html).not.toMatch(/unsubscribe/i);
    expect(rendered.text).not.toMatch(/unsubscribe/i);
    expect(rendered.html).toContain("Manage notifications");
  });
});

describe("money and snapshots", () => {
  it("formats money from minor units and currency", () => {
    expect(formatMoney({ amountMinor: 1250050, currency: "NGN" }, "en-NG")).toBe("₦12,500.50");
    expect(formatMoney({ amountMinor: 1999, currency: "USD" }, "en-US")).toBe("$19.99");
    expect(formatMoney({ amountMinor: 1500, currency: "JPY" }, "en-US")).toBe("¥1,500");
  });

  it("uses the order currency instead of a hardcoded naira sign", async () => {
    const sample = readEmailTemplate("paymentFailed").sample;
    const rendered = await renderEmail("paymentFailed", { ...sample, amount: { amountMinor: 4999, currency: "USD" } }, { locale: "en-US" });
    expect(rendered.text).toContain("$49.99");
    expect(rendered.text).not.toContain("₦");
  });

  it.each(["orderShipped", "policyUpdated", "weeklyDigest", "emailOtp"] as const)("%s plain text matches snapshot", async (key) => {
    const rendered = await renderEmailSample(key);
    expect(`${rendered.subject}\n\n${rendered.text.replace(/© \d{4}/, "© YEAR")}`).toMatchSnapshot();
  });
});

describe("zudoversary", () => {
  it("uses ordinals, the milestones category and the transactional kind", async () => {
    const entry = catalogue.find((item) => item.key === "zudoversary");
    expect(entry?.category).toBe("milestones");
    expect(entry?.kind).toBe("transactional");
    const sample = readEmailTemplate("zudoversary").sample;
    for (const [years, label] of [[1, "1st"], [2, "2nd"], [3, "3rd"], [4, "4th"], [11, "11th"], [12, "12th"], [21, "21st"]] as const) {
      const rendered = await renderEmail("zudoversary", { ...sample, years });
      expect(rendered.subject).toBe(`Happy ${label} Zudoversary, Ada`);
    }
  });

  it("shows only the stats that are available", async () => {
    const withStats = await renderEmail("zudoversary", { firstName: "Ada", years: 2, stats: { followers: 1260, orders: 0 } });
    expect(withStats.text).toContain("Followers gained");
    expect(withStats.text).toContain("1,260");
    expect(withStats.text).not.toContain("Orders completed");
    const withoutStats = await renderEmail("zudoversary", { firstName: "Ada", years: 1 });
    expect(withoutStats.text).not.toContain("Your time on Zudomart");
    expect(withoutStats.text).toContain("thanks for being part of Zudomart for 1 year");
  });
});

describe("senders and brand", () => {
  it("sends receipts from receipts@mail and replies to billing", async () => {
    const rendered = await renderEmailSample("paymentReceipt");
    expect(rendered.sender).toEqual({ from: "Zudomart Receipts <receipts@mail.zudomart.com>", replyTo: "billing@zudomart.com" });
  });

  it("sends security mail from noreply@mail with replies to support", async () => {
    const rendered = await renderEmailSample("emailOtp");
    expect(rendered.sender).toEqual({ from: "Zudomart <noreply@mail.zudomart.com>", replyTo: "support@zudomart.com" });
  });

  it("derives addresses and hosted badges from the environment", () => {
    const brand = readEmailBrandFromEnvironment({ ZUDOMART_MAIL_DOMAIN: "example.ng", ZUDOMART_EMAIL_ASSET_BASE_URL: "https://cdn.example.ng/e/", ZUDOMART_APP_STORE_ID: "id123456789" });
    expect(brand.supportEmails).toEqual(["support@example.ng"]);
    expect(brand.sendingDomain).toBe("mail.example.ng");
    expect(brand.appStoreBadgeUrl).toBe("https://cdn.example.ng/e/storeBadges/app-store-badge-black@2x.png");
    expect(brand.appStoreUrl).toBe("https://apps.apple.com/app/id123456789");
    expect(readEmailBrandFromEnvironment({ ZUDOMART_EMAIL_PLAY_STORE_BADGE_URL: "none" }).playStoreBadgeUrl).toBeNull();
  });

  it("falls back to text store buttons when badge images are off", async () => {
    const rendered = await renderEmailSample("orderShipped", { brand: { appStoreBadgeUrl: null, playStoreBadgeUrl: null } });
    expect(rendered.html).toContain("Download on the App Store");
    expect(rendered.html).not.toContain("<img alt=\"Download on the App Store\"");
  });
});

describe("verification rejection when the plan keeps running", () => {
  const sample = readEmailTemplate("verificationRejectedRefunded").sample;

  it("tells the person the plan stays active and how much was refunded for the checkmark", async () => {
    const rendered = await renderEmail("verificationRejectedRefunded", { ...sample, checkmark: "Gold", refundMethod: "plan_share_card", refundAmount: { amountMinor: 300000, currency: "NGN" } });
    expect(rendered.subject).toContain("Your plan stays active");
    expect(rendered.text).toContain("Your plan stays active; we've refunded");
    expect(rendered.text).toContain("₦3,000");
    expect(rendered.text).toContain("for the checkmark");
    expect(rendered.text).not.toContain("full amount");
  });

  it("explains the store route without promising a card refund", async () => {
    const rendered = await renderEmail("verificationRejectedRefunded", { ...sample, refundMethod: "plan_share_store", refundAmount: { amountMinor: 250000, currency: "NGN" } });
    expect(rendered.text).toContain("app store");
    expect(rendered.text).toContain("reportaproblem.apple.com");
    expect(rendered.text).not.toContain("to the card you paid with");
  });

  it("keeps the full-refund wording for standalone checkmarks", async () => {
    const rendered = await renderEmail("verificationRejectedRefunded", sample);
    expect(rendered.text).toContain("refunded the full amount");
  });
});

describe("refund emails say where the money lands", () => {
  const sample = readEmailTemplate("refundIssued").sample;

  it("tells a wallet refund that the money is already in the Zudomart wallet", async () => {
    const rendered = await renderEmail("refundIssued", sample);
    expect(rendered.subject).toContain("is in your Zudomart wallet");
    expect(rendered.text).toContain("Back to: Your Zudomart wallet");
    expect(rendered.text).toContain("Arrives: Now");
    expect(rendered.text).not.toContain("original payment method");
    expect(rendered.text).not.toContain("on your statement");
  });

  it("keeps the bank timing for a refund back to the card", async () => {
    const rendered = await renderEmail("refundIssued", { ...sample, refundDestination: "paymentMethod", refundMethod: "The card you paid with" });
    expect(rendered.subject).toContain("is on its way");
    expect(rendered.text).toContain("Back to: The card you paid with");
    expect(rendered.text).toContain("3–5 business days");
  });

  it("does not promise the original payment method when an order is cancelled", async () => {
    const rendered = await renderEmail("orderCancelled", readEmailTemplate("orderCancelled").sample);
    expect(rendered.text).toContain("Your Zudomart wallet, or your card if the payment hadn't settled yet");
    expect(rendered.text).not.toContain("Original payment method");
  });
});
