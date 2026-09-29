import { afterAll, describe, expect, it } from "vitest";

import { parseDecimalRateToScaledInteger } from "../../../src/utils/exchangeRate.util.js";
import { createTestApplication } from "../../fixtures/testApplication.fixture.js";

const app = createTestApplication({
  external: {
    exchangeRateProvider: {
      fetchUnitsPerUsDollar: async () => ({
        source: "test",
        scaledUnitsPerUsDollar: { NGN: parseDecimalRateToScaledInteger("1600"), GBP: parseDecimalRateToScaledInteger("0.78") },
      }),
    },
  },
});
const withoutTrustedHeader = createTestApplication({ settings: { locale: { trustedCountryHeader: "" } } });
afterAll(async () => {
  await app.close();
  await withoutTrustedHeader.close();
});

describe("GET /api/v1/locale", () => {
  it("falls back to US dollars when nothing is known", async () => {
    await app.client.get("/api/v1/locale").expect(200).expectJson({ countryCode: null, currency: "USD", isCountrySupported: false });
  });

  it("uses the device region hint when there is nothing better", async () => {
    await app.client.get("/api/v1/locale").set("x-client-region", "gh").expect(200).expectJson({ countryCode: "GH", currency: "GHS", isCountrySupported: true });
  });

  it("uses US dollars for an unsupported country", async () => {
    await app.client.get("/api/v1/locale").set("x-client-region", "BR").expect(200).expectJson({ countryCode: "BR", currency: "USD", isCountrySupported: false });
  });

  it("prefers the trusted proxy header over the client hint", async () => {
    await app.client
      .get("/api/v1/locale")
      .set({ "cf-ipcountry": "NG", "x-client-region": "GB" })
      .expect(200)
      .expectJson({ countryCode: "NG", currency: "NGN" });
  });

  it("ignores proxy country headers unless a trusted header is configured", async () => {
    await withoutTrustedHeader.client
      .get("/api/v1/locale")
      .set({ "cf-ipcountry": "NG" })
      .expect(200)
      .expectJson({ countryCode: null, currency: "USD" });
  });

  it("prefers the signed-in user's saved country and currency", async () => {
    const user = await app.registerUser();
    await app.client.patch("/api/v1/users/me/preferences").auth(user.accessToken).send({ countryCode: "ke" }).expect(200).expectJson({ countryCode: "KE", currency: null });
    await app.client.get("/api/v1/locale").auth(user.accessToken).set({ "cf-ipcountry": "ZA" }).expect(200).expectJson({ countryCode: "KE", currency: "KES" });
    await app.client.patch("/api/v1/users/me/preferences").auth(user.accessToken).send({ currency: "EUR" }).expect(200);
    await app.client.get("/api/v1/locale").auth(user.accessToken).expect(200).expectJson({ countryCode: "KE", currency: "EUR", isCountrySupported: true });
    await app.client.patch("/api/v1/users/me/preferences").auth(user.accessToken).send({ currency: "JPY" }).expect(400);
  });
});

describe("exchange rates", () => {
  it("lists rates into the viewer's currency and refreshes them from the provider", async () => {
    const before = await app.client.get("/api/v1/currencies").set("x-client-region", "GB").expect(200);
    const nairaBefore = before.json<{ rates: { currency: string; rate: string }[] }>().rates.find((rate) => rate.currency === "NGN");
    expect(nairaBefore?.rate).toBe("0.000503226");

    const admin = await app.registerAdmin();
    await app.client.post("/api/v1/admin/exchange-rates/refresh").auth(admin.accessToken).expect(200);
    const after = await app.client.get("/api/v1/currencies").set("x-client-region", "GB").expect(200);
    expect(after.json<{ rates: { currency: string; rate: string }[] }>().rates.find((rate) => rate.currency === "NGN")?.rate).toBe("0.0004875");
  });

  it("only lets admins refresh exchange rates", async () => {
    const user = await app.registerUser();
    await app.client.post("/api/v1/admin/exchange-rates/refresh").auth(user.accessToken).expect(403);
    await app.client.post("/api/v1/admin/exchange-rates/refresh").expect(401);
  });
});
