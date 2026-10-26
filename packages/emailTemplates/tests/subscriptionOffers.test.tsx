import { describe, expect, it } from "vitest";

import { readEmailTemplate, renderEmail, renderEmailSample } from "../src/index";

describe("subscription offer email", () => {
  it("leads with the offer, quotes the note and has one claim button", async () => {
    const sample = readEmailTemplate("subscriptionOfferInvite").sample;
    const rendered = await renderEmailSample("subscriptionOfferInvite", { locale: "en-NG" });
    expect(rendered.subject).toBe("Your Nantty offer: 30% off Pro plan");
    expect(rendered.html).toContain(sample.claimUrl);
    expect(rendered.text.match(/Claim your offer/g)?.length).toBe(1);
    expect(rendered.text).toContain("Thanks for joining our seller pilot.");
    expect(rendered.text).toContain("Your first 3 billing cycles");
    expect(rendered.text).toContain("first person to use it");
  });

  it("formats fixed amounts in the offer currency and escapes the note", async () => {
    const rendered = await renderEmail("subscriptionOfferInvite", {
      planLabels: ["Pro plan", "Business plan"], amountOff: { amountMinor: 200000, currency: "NGN" }, durationCycles: 1,
      note: "<script>alert(1)</script> & <b>bold</b>", claimUrl: "https://nantty.com/offer/abc", singleUse: false,
    }, { locale: "en-NG" });
    expect(rendered.subject).toContain("₦2,000.00 off Pro plan or Business plan");
    expect(rendered.html).not.toContain("<script>alert(1)</script>");
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.text).toContain("Your first payment");
    expect(rendered.text).toContain("No end date");
    expect(rendered.text).not.toContain("first person to use it");
  });
});
