import { describe, expect, it } from "vitest";

import { emailTemplateKeys, formatMoney, listEmailTemplateCatalogue, readEmailTemplate, renderEmail, renderEmailSample } from "../src/index";

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
      expect(rendered.html).toContain("oyinlola.tech@icloud.com");
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
