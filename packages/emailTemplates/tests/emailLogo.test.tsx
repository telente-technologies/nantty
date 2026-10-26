import { describe, expect, it } from "vitest";

import { defaultEmailBrand, readEmailBrandFromEnvironment } from "../src/config/emailBrand.config";

describe("email header logo", () => {
  it("serves the lockup PNG from the asset base", () => {
    expect(defaultEmailBrand.logoUrl).toBe("https://nantty.com/brand/nantty-lockup.png");
    expect(readEmailBrandFromEnvironment({ ZUDOMART_EMAIL_ASSET_BASE_URL: "https://assets.example.com/mail/" }).logoUrl).toBe("https://assets.example.com/mail/brand/nantty-lockup.png");
  });

  it("falls back to the text wordmark when the logo is turned off", () => {
    expect(readEmailBrandFromEnvironment({ ZUDOMART_EMAIL_LOGO_URL: "none" }).logoUrl).toBeNull();
  });
});
