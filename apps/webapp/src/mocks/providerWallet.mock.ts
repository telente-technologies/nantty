import { ApiError } from "@/errors/api.error";
import type { PaymentVerificationLevel, ProviderWalletResponse } from "@/types/providerWallet.type";

import { createMockRoute, type MockRoute } from "./registry.mock";

const walletDailyLimitMinor = 5_000_000;

export const mockProviderWalletState = {
  hasWallet: true,
  availableMinor: 8_500_000,
  depositHoldMinor: 1_500_000,
  spentTodayMinor: 0,
  declinedReferences: new Set<string>(),
  walletPaidReferences: new Set<string>(),
};

const buildWallet = (): ProviderWalletResponse => ({
  wallet: {
    provider: "flutterwave",
    currency: "NGN",
    status: "active",
    accountName: "ADAEZE NNAMDI OKONKWO",
    accountNumber: "8571234567",
    bankName: "Wema Bank",
    bankCode: "035",
    fundingNumbers: [{ accountNumber: "8571234567", bankName: "Wema Bank" }],
    createdAt: "2026-10-10T09:00:00.000Z",
    frozenAt: null,
  },
  balances: {
    currency: "NGN",
    availableMinor: mockProviderWalletState.availableMinor,
    depositHoldMinor: mockProviderWalletState.depositHoldMinor,
    escrowLockedMinor: 2_450_000,
    outgoingMinor: 0,
    reservedPayoutMinor: 0,
    debtMinor: 0,
  },
});

const verificationLevel = (): PaymentVerificationLevel => ({ level: 1, payoutVerified: true, identityVerified: false, country: "NG", method: "bvn", nextStep: "identity" });

const walletNotReady = () => new ApiError(409, "Your wallet is not ready yet. Finish verification first.", "WALLET_NOT_READY");

export function payOrderFromMockWallet(reference: string, amountMinor: number): void {
  if (mockProviderWalletState.walletPaidReferences.has(reference)) return;
  if (!mockProviderWalletState.hasWallet) throw walletNotReady();
  const remaining = walletDailyLimitMinor - mockProviderWalletState.spentTodayMinor;
  if (amountMinor > remaining) {
    throw new ApiError(422, "This payment is more than your wallet can pay today.", "WALLET_DAILY_LIMIT", undefined, {
      tier: "basic",
      limit: { amountMinor: walletDailyLimitMinor, currency: "NGN" },
      remaining: { amountMinor: Math.max(remaining, 0), currency: "NGN" },
    });
  }
  const fromHold = Math.min(mockProviderWalletState.depositHoldMinor, amountMinor);
  if (mockProviderWalletState.availableMinor + mockProviderWalletState.depositHoldMinor < amountMinor) {
    throw new ApiError(422, "This payment cannot be paid from your wallet.", "WALLET_PAYMENT_NOT_ALLOWED");
  }
  mockProviderWalletState.depositHoldMinor -= fromHold;
  mockProviderWalletState.availableMinor -= amountMinor - fromHold;
  mockProviderWalletState.spentTodayMinor += amountMinor;
  mockProviderWalletState.walletPaidReferences.add(reference);
}

let bankValidationStatus: "not_started" | "pending" | "verified" = "verified";

export const providerWalletMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/payments/wallet/me", () => (mockProviderWalletState.hasWallet ? buildWallet() : { wallet: null, status: "not_ready", balances: { currency: "NGN", availableMinor: 0, depositHoldMinor: 0, escrowLockedMinor: 0, outgoingMinor: 0, reservedPayoutMinor: 0, debtMinor: 0 } })),
  createMockRoute("POST", "/api/v1/payments/wallet/me/activate", () => {
    mockProviderWalletState.hasWallet = true;
    return buildWallet();
  }),
  createMockRoute("GET", "/api/v1/payments/verification/me", () => verificationLevel()),
  createMockRoute("POST", "/api/v1/payments/demo/:reference/decline", ({ params }) => {
    mockProviderWalletState.declinedReferences.add(params.reference!);
    return { reference: params.reference, status: "failed" };
  }),
  createMockRoute("GET", "/api/v1/payments/payout-onboarding/me/bank-validation", () => {
    const status = bankValidationStatus;
    if (bankValidationStatus === "pending") bankValidationStatus = "verified";
    return { status };
  }),
  createMockRoute("POST", "/api/v1/payments/payout-onboarding/me/bank-validation", () => {
    bankValidationStatus = "pending";
    return { status: "pending", reference: `bvn-${Date.now()}` };
  }),
];
