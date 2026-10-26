import { readMockPayoutOnboardingState } from "@/mocks/handlers/payoutOnboarding.mock";
import { MockHttpError, requireMockStorePrincipal, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";

type ConsentStatus = "not_started" | "pending" | "verified" | "failed";
const consentHolder = globalThis as typeof globalThis & { __zudomartSellerBvnConsent?: Map<string, { status: ConsentStatus; startedAt: number }> };
const CONSENT_DELAY_MS = 6_000;

function readConsent(storeId: string): { status: ConsentStatus; startedAt: number } {
  const map = (consentHolder.__zudomartSellerBvnConsent ??= new Map());
  const record = map.get(storeId) ?? { status: "not_started" as ConsentStatus, startedAt: 0 };
  if (record.status === "pending" && Date.now() - record.startedAt > CONSENT_DELAY_MS) record.status = "verified";
  map.set(storeId, record);
  return record;
}

export function registerProviderWalletMockHandlers(): void {
  registerMockRoute("GET", "/payments/verification/me", (request) => {
    const state = readMockPayoutOnboardingState(requireMockStorePrincipal(request).storeId);
    const verified = state.status === "verified";
    return respondWithJson(200, { level: verified ? 1 : 0, payoutVerified: verified, identityVerified: false, country: "NG", method: verified ? "bvn" : null, nextStep: verified ? null : "payout_setup", unlocks: {} });
  });

  registerMockRoute("GET", "/payments/wallet/me", (request) => {
    const state = readMockPayoutOnboardingState(requireMockStorePrincipal(request).storeId);
    if (state.status !== "verified") throw new MockHttpError(409, "WALLET_NOT_READY", "Your wallet is not ready yet. Finish verification first.");
    return respondWithJson(200, {
      wallet: { provider: "flutterwave", currency: "NGN", status: "active", accountName: state.legalName ?? "NANTTY SELLER", accountNumber: "8573920146", bankName: "Mock Microfinance Bank", bankCode: "090000", fundingNumbers: [{ accountNumber: "8573920146", bankName: "Mock Microfinance Bank" }], createdAt: new Date(Date.now() - 86_400_000).toISOString(), frozenAt: null },
      balances: { currency: "NGN", availableMinor: 1_250_000, depositHoldMinor: 0, escrowLockedMinor: 0, outgoingMinor: 0, reservedPayoutMinor: 0, debtMinor: 0 },
    });
  });

  registerMockRoute("POST", "/payments/payout-onboarding/me/bank-validation", (request) => {
    const { storeId } = requireMockStorePrincipal(request);
    const state = readMockPayoutOnboardingState(storeId);
    if (state.idType !== "bvn") throw new MockHttpError(422, "BVN_REQUIRED", "Add your BVN in payout setup so we can verify your bank account.");
    const record = readConsent(storeId);
    if (record.status === "verified") return respondWithJson(202, { status: "verified" });
    record.status = "pending";
    record.startedAt = Date.now();
    return respondWithJson(202, { status: "pending", consentUrl: "/settings/payouts?bvnConsent=returned", reference: `bvn-mock-${storeId}` });
  });

  registerMockRoute("GET", "/payments/payout-onboarding/me/bank-validation", (request) => respondWithJson(200, { status: readConsent(requireMockStorePrincipal(request).storeId).status }));
}
