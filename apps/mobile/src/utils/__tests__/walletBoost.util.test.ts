import { ApiError } from "@/errors/api.error";
import type { BoostOptions, FreeBoostAllowance } from "@/types/boost.type";
import type { WalletSummary } from "@/types";

import { boostErrorMessage, fitsWithinFreeBoost, nativeBoostPaymentMethods, pickFreeBoostSelection, usableFreeBoost } from "../boostPayment.util";
import { formatCoinCount, formatWalletLineAmount, walletLinesForDisplay, walletVerificationMessage } from "../walletLines.util";

const ngn = (amountMinor: number) => ({ amountMinor, currency: "NGN" as const });

describe("wallet lines", () => {
  it("formats the coins line as coins, never money", () => {
    expect(formatWalletLineAmount({ amountMinor: 1200, currency: "COIN" })).toBe("1,200 coins");
    expect(formatCoinCount(1)).toBe("1 coin");
    expect(formatCoinCount(0)).toBe("0 coins");
    expect(formatCoinCount(Number.NaN)).toBe("0 coins");
  });

  it("keeps backend order and labels", () => {
    const wallet: WalletSummary = {
      available: ngn(0),
      pending: ngn(0),
      lines: [
        { key: "pending", label: "Pending (escrow)", description: "", amount: ngn(500) },
        { key: "coins", label: "Coins", description: "", amount: { amountMinor: 3, currency: "COIN" } },
      ],
    };
    expect(walletLinesForDisplay(wallet).map((line) => line.label)).toEqual(["Pending (escrow)", "Coins"]);
  });

  it("falls back to available and pending for an older backend", () => {
    const lines = walletLinesForDisplay({ available: ngn(100), pending: ngn(0) });
    expect(lines.map((line) => line.key)).toEqual(["available", "pending"]);
    expect(walletLinesForDisplay(undefined)).toEqual([]);
  });

  it("only shows a verification message when the backend sends one", () => {
    expect(walletVerificationMessage({ available: ngn(0), pending: ngn(0) })).toBeNull();
    expect(walletVerificationMessage({ available: ngn(0), pending: ngn(0), verification: { level: 1, withdrawalsUnlocked: true, waitingForVerification: ngn(0), nextStep: null, message: null } })).toBeNull();
    expect(walletVerificationMessage({ available: ngn(0), pending: ngn(0), verification: { level: 0, withdrawalsUnlocked: false, waitingForVerification: ngn(1_250_000), nextStep: "payout_setup", message: "Verify to withdraw ₦12,500" } })).toBe("Verify to withdraw ₦12,500");
  });
});

describe("boost payment", () => {
  const free: FreeBoostAllowance = { premium: true, eligible: true, remainingThisMonth: 1, maxTotal: ngn(100_000), resetsAt: "2026-11-01T00:00:00Z" };
  const options: BoostOptions = {
    minimumDailyBudget: ngn(100_000),
    suggestedDailyBudgets: [ngn(100_000), ngn(300_000)],
    durationDayOptions: [1, 3],
    interests: [],
    paymentMethods: ["card", "balance", "free"],
    freeBoost: free,
    packages: [
      { priceMinor: 100_000, currency: "NGN", days: 1, label: "1 day", estimatedReach: { low: 1, high: 2 }, impressions: { low: 1, high: 2 } },
      { priceMinor: 300_000, currency: "NGN", days: 3, label: "3 days", estimatedReach: { low: 1, high: 2 }, impressions: { low: 1, high: 2 } },
    ],
  };

  it("never offers balance in the app", () => {
    expect(nativeBoostPaymentMethods(options)).toEqual(["card", "free"]);
    expect(nativeBoostPaymentMethods({ ...options, paymentMethods: undefined })).toEqual(["card"]);
  });

  it("offers the free boost only to Premium users with one left", () => {
    expect(usableFreeBoost(options)).toBe(free);
    expect(usableFreeBoost({ ...options, freeBoost: { ...free, remainingThisMonth: 0, eligible: false } })).toBeNull();
    expect(usableFreeBoost({ ...options, paymentMethods: ["card"], freeBoost: { ...free, premium: false } })).toBeNull();
    expect(usableFreeBoost({ ...options, freeBoost: undefined })).toBeNull();
  });

  it("preselects the largest package within the free cap", () => {
    expect(pickFreeBoostSelection(options, free)).toEqual({ dailyBudget: ngn(100_000), durationDays: 1 });
    expect(pickFreeBoostSelection(options, { ...free, maxTotal: ngn(50_000) })).toBeNull();
    expect(fitsWithinFreeBoost(ngn(300_000), free)).toBe(false);
  });

  it("maps contract error codes to readable copy", () => {
    expect(boostErrorMessage(new ApiError(409, "x", "FREE_BOOST_USED"))).toMatch(/already used/);
    expect(boostErrorMessage(new ApiError(403, "x", "PAYMENT_METHOD_NOT_AVAILABLE_IN_APP"))).toMatch(/card or bank transfer/);
    expect(boostErrorMessage(new Error(""))).toBe("Couldn't start your boost. Please try again.");
  });
});
