import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BoostOptions } from "../types/boost.type";
import type { WalletSummary } from "../types";
import { boostErrorMessageForCode, pickFreeBoostSelection, readBoostPaymentMethods, readUsableFreeBoost } from "./boostPayment.util";
import { formatCoinCount, formatWalletLineAmount, readVerificationLevel, readVerifyToWithdrawMessage, readWalletLines, verifyActionForWallet } from "./walletLines.util";

const ngn = (amountMinor: number) => ({ amountMinor, currency: "NGN" as const });
const baseOptions: BoostOptions = { minimumDailyBudget: ngn(100_000), suggestedDailyBudgets: [ngn(100_000), ngn(300_000), ngn(700_000)], durationDayOptions: [1, 3, 7], interests: [] };
const freeBoost = { premium: true, eligible: true, remainingThisMonth: 1, maxTotal: ngn(300_000), resetsAt: null };

describe("wallet lines", () => {
  it("formats the coins line as a coin count, never as money", () => {
    assert.equal(formatWalletLineAmount({ amount: { amountMinor: 1200, currency: "COIN" } }), "1,200 coins");
    assert.equal(formatWalletLineAmount({ amount: { amountMinor: 0, currency: "COIN" } }), "0 coins");
    assert.equal(formatCoinCount(1), "1 coin");
    assert.ok(!formatWalletLineAmount({ amount: { amountMinor: 1200, currency: "COIN" } }).includes("₦"));
  });

  it("keeps backend lines in order and falls back to available and pending on older backends", () => {
    const lines = [
      { key: "pending", label: "Pending (escrow)", description: "x", amount: ngn(5) },
      { key: "available", label: "Available to withdraw", description: "y", amount: ngn(10) },
    ];
    assert.deepEqual(readWalletLines({ available: ngn(10), pending: ngn(5), lines }).map((line) => line.key), ["pending", "available"]);
    assert.deepEqual(readWalletLines({ available: ngn(10), pending: ngn(5) }).map((line) => line.label), ["Available to withdraw", "Pending (escrow)"]);
    assert.equal(readWalletLines({ available: ngn(10), pending: ngn(5), lines: [] }).length, 2);
  });

  it("reads the verification message and level defensively", () => {
    const old: WalletSummary = { available: ngn(0), pending: ngn(0) };
    assert.equal(readVerifyToWithdrawMessage(old), null);
    assert.equal(readVerificationLevel(old), 0);
    const unverified: WalletSummary = { ...old, verification: { level: 0, withdrawalsUnlocked: false, waitingForVerification: ngn(1_250_000), nextStep: "payout_setup", message: "Verify to withdraw ₦12,500" } };
    assert.equal(readVerifyToWithdrawMessage(unverified), "Verify to withdraw ₦12,500");
    assert.equal(readVerificationLevel({ ...old, verification: { ...unverified.verification!, level: 1, withdrawalsUnlocked: true, message: null } }), 1);
  });

  it("sends business verification to the seller flow and anything else to payout setup", () => {
    const withStep = (nextStep: string | null): WalletSummary => ({ available: ngn(0), pending: ngn(0), verification: { level: 1, withdrawalsUnlocked: false, waitingForVerification: ngn(0), nextStep, message: "Verify to withdraw your earnings" } });
    assert.equal(verifyActionForWallet(withStep("business_verification"), "/p").href, "/seller/apply");
    assert.equal(verifyActionForWallet(withStep("payout_setup"), "/p").href, "/p");
    assert.equal(verifyActionForWallet(withStep("something_new"), "/p").href, "/p");
    assert.equal(verifyActionForWallet(undefined, "/p").href, "/p");
  });
});

describe("boost payment helpers", () => {
  it("defaults to card when an older backend lists no payment methods", () => {
    assert.deepEqual(readBoostPaymentMethods(baseOptions), ["card"]);
    assert.deepEqual(readBoostPaymentMethods({ ...baseOptions, paymentMethods: ["card", "balance", "free"] }), ["card", "balance", "free"]);
  });

  it("offers the free boost only to Premium users with one left this month", () => {
    const withFree = { ...baseOptions, paymentMethods: ["card", "free"] as const, freeBoost };
    assert.ok(readUsableFreeBoost(withFree));
    assert.equal(readUsableFreeBoost({ ...withFree, freeBoost: { ...freeBoost, remainingThisMonth: 0 } }), null);
    assert.equal(readUsableFreeBoost({ ...withFree, freeBoost: { ...freeBoost, premium: false, eligible: false } }), null);
    assert.equal(readUsableFreeBoost({ ...withFree, paymentMethods: ["card"] }), null);
  });

  it("preselects the largest budget that fits the free boost cap", () => {
    assert.deepEqual(pickFreeBoostSelection(baseOptions.suggestedDailyBudgets, [1, 3, 7], ngn(300_000), 3), { budgetIndex: 0, days: 3 });
    assert.deepEqual(pickFreeBoostSelection(baseOptions.suggestedDailyBudgets, [1, 3, 7], ngn(300_000), 7), { budgetIndex: 1, days: 1 });
    assert.equal(pickFreeBoostSelection(baseOptions.suggestedDailyBudgets, [1, 3, 7], ngn(50_000), 3), null);
  });

  it("maps contract error codes to readable copy", () => {
    assert.match(boostErrorMessageForCode("FREE_BOOST_USED") ?? "", /already used/);
    assert.equal(boostErrorMessageForCode("SOMETHING_ELSE"), null);
  });
});
