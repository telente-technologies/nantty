import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultPaymentLimits, defaultSellerDebtLimits, validatePaymentLimits, validateSellerDebtLimits } from "@/mocks/handlers/configuration/moneyLimitsValidation.mock";

describe("seller.debtLimits and payments.limits settings", () => {
  it("accept the owner-approved Go defaults", () => {
    assert.deepEqual(validateSellerDebtLimits(defaultSellerDebtLimits), defaultSellerDebtLimits);
    assert.deepEqual(validatePaymentLimits(defaultPaymentLimits), defaultPaymentLimits);
    assert.equal(defaultSellerDebtLimits.baseMinor.unverified, 1_000_000);
    assert.equal(defaultPaymentLimits.baseMinor.walletDaily.full, 500_000_000);
  });

  it("refuse out-of-order levels, NGN overrides and unknown keys like the Go validator", () => {
    assert.throws(() => validateSellerDebtLimits({ ...defaultSellerDebtLimits, baseMinor: { unverified: 9_000_000, payoutVerified: 5_000_000, identityVerified: 20_000_000 } }));
    assert.throws(() => validateSellerDebtLimits({ ...defaultSellerDebtLimits, currencyOverridesMinor: { NGN: { unverified: 1, payoutVerified: 2, identityVerified: 3 } } }));
    assert.throws(() => validateSellerDebtLimits({ ...defaultSellerDebtLimits, outsideNigeriaPercent: 0 }));
    assert.throws(() => validatePaymentLimits({ ...defaultPaymentLimits, extra: 1 }));
    assert.throws(() => validatePaymentLimits({ baseMinor: { ...defaultPaymentLimits.baseMinor, walletDaily: { basic: 30_000_000, mid: 20_000_000, full: 500_000_000 } }, currencyOverridesMinor: {} }));
    assert.equal(validateSellerDebtLimits({ ...defaultSellerDebtLimits, currencyOverridesMinor: { GHS: { unverified: 4_000, payoutVerified: 20_000, identityVerified: 80_000 } } }).currencyOverridesMinor["GHS"]?.payoutVerified, 20_000);
  });

  it("fill the ads step-up threshold for documents saved before it existed and keep it within the top-up maximum", () => {
    const { adsStepUpAbove: _omitted, ...legacyBase } = defaultPaymentLimits.baseMinor;
    assert.equal(validatePaymentLimits({ baseMinor: legacyBase, currencyOverridesMinor: {} }).baseMinor.adsStepUpAbove, 5_000_000);
    assert.throws(() => validatePaymentLimits({ baseMinor: { ...defaultPaymentLimits.baseMinor, adsStepUpAbove: 2_000_000_000 }, currencyOverridesMinor: {} }));
  });
});
