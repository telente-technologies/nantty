import { ApiError } from "@/errors/api.error";

import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

interface MockWalletState {
  hasWallet: boolean;
  bvnStatus: "not_started" | "pending" | "verified";
  bvnChecks: number;
}

const state: MockWalletState = { hasWallet: true, bvnStatus: "not_started", bvnChecks: 0 };

export const resetMockProviderWallet = (next: Partial<MockWalletState> = {}) => Object.assign(state, { hasWallet: true, bvnStatus: "not_started", bvnChecks: 0 }, next);

const buildWallet = () => {
  if (!state.hasWallet) throw new ApiError(409, "Your wallet is not ready yet. Finish verification first.", "WALLET_NOT_READY");
  const user = getSignedInMockUser();
  return {
    wallet: {
      provider: "flutterwave",
      currency: "NGN",
      status: "active",
      accountName: `${user.name ?? "Zudomart User"}`.toUpperCase(),
      accountNumber: "8571234567",
      bankName: "Wema Bank",
      bankCode: "035",
      fundingNumbers: [{ accountNumber: "8571234567", bankName: "Wema Bank" }],
      createdAt: "2026-09-01T09:00:00.000Z",
      frozenAt: null,
    },
    balances: { currency: "NGN", availableMinor: 4_500_000, depositHoldMinor: 1_000_000, escrowLockedMinor: 1_250_000, outgoingMinor: 0, reservedPayoutMinor: 0, debtMinor: 0 },
  };
};

export const providerWalletMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/payments/wallet/me", () => buildWallet()),
  createMockRoute("POST", "/api/v1/payments/wallet/me/activate", () => {
    state.hasWallet = true;
    return buildWallet();
  }),
  createMockRoute("GET", "/api/v1/payments/verification/me", () => ({
    level: state.hasWallet ? 1 : 0,
    payoutVerified: state.hasWallet,
    identityVerified: false,
    country: "NG",
    method: state.hasWallet ? "bvn_consent" : null,
    nextStep: state.hasWallet ? "identity_check" : "payout_setup",
    unlocks: {},
  })),
  createMockRoute("POST", "/api/v1/payments/payout-onboarding/me/bank-validation", () => {
    state.bvnStatus = "pending";
    state.bvnChecks = 0;
    return { status: "pending", consentUrl: "https://checkout.flutterwave.com/v3/bvn/mock-consent", reference: "bvn-mock-consent" };
  }),
  createMockRoute("GET", "/api/v1/payments/payout-onboarding/me/bank-validation", () => {
    if (state.bvnStatus === "pending" && ++state.bvnChecks >= 2) {
      state.bvnStatus = "verified";
      state.hasWallet = true;
    }
    return { status: state.bvnStatus };
  }),
];
