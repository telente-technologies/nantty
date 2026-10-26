import { ApiError } from "@/errors/api.error";
import { readMockPayoutOnboardingState } from "@/mocks/payoutOnboarding.mock";
import { createMockRoute, type MockRoute } from "@/mocks/registry.mock";

type ConsentStatus = "not_started" | "pending" | "verified" | "failed";
const consent: { status: ConsentStatus; startedAt: number } = { status: "not_started", startedAt: 0 };
const CONSENT_DELAY_MS = 6_000;

function readConsent(): ConsentStatus {
  if (consent.status === "pending" && Date.now() - consent.startedAt > CONSENT_DELAY_MS) consent.status = "verified";
  return consent.status;
}

export const providerWalletMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/payments/verification/me", () => {
    const verified = readMockPayoutOnboardingState().status === "verified";
    return { level: verified ? 1 : 0, payoutVerified: verified, identityVerified: false, country: "NG", method: verified ? "bvn" : null, nextStep: verified ? null : "payout_setup", unlocks: {} };
  }),
  createMockRoute("GET", "/api/v1/payments/wallet/me", () => {
    const state = readMockPayoutOnboardingState();
    if (state.status !== "verified") throw new ApiError(409, "Your wallet is not ready yet. Finish verification first.", "WALLET_NOT_READY");
    return {
      wallet: { provider: "flutterwave", currency: "NGN", status: "active", accountName: state.legalName ?? "NANTTY CREATOR", accountNumber: "8573920177", bankName: "Mock Microfinance Bank", bankCode: "090000", fundingNumbers: [{ accountNumber: "8573920177", bankName: "Mock Microfinance Bank" }], createdAt: new Date(Date.now() - 86_400_000).toISOString(), frozenAt: null },
      balances: { currency: "NGN", availableMinor: 0, depositHoldMinor: 0, escrowLockedMinor: 0, outgoingMinor: 0, reservedPayoutMinor: 0, debtMinor: 0 },
    };
  }),
  createMockRoute("POST", "/api/v1/payments/payout-onboarding/me/bank-validation", () => {
    if (readMockPayoutOnboardingState().idType !== "bvn") throw new ApiError(422, "Add your BVN in payout setup so we can verify your bank account.", "BVN_REQUIRED");
    if (readConsent() === "verified") return { status: "verified" };
    consent.status = "pending";
    consent.startedAt = Date.now();
    return { status: "pending", consentUrl: "/earnings?bvnConsent=returned", reference: "bvn-mock-creator" };
  }),
  createMockRoute("GET", "/api/v1/payments/payout-onboarding/me/bank-validation", () => ({ status: readConsent() })),
];
