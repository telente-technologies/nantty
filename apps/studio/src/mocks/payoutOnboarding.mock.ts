import { ApiError } from "@/errors/api.error";
import { createMockRoute, type MockRoute } from "@/mocks/registry.mock";
import type { PayoutOnboardingState, PayoutOnboardingStep } from "@/types/payoutOnboarding.type";

interface PayoutOnboardingRecord {
  state: PayoutOnboardingState;
  idNumber: string;
  legalName: string;
  identitySavedAt: number | null;
  creationFailed: boolean;
  submittedAt: number | null;
  linkFailedOnce: boolean;
}

const CREATION_DELAY_MS = 6_000;
const REVIEW_DELAY_MS = 12_000;
const holder = globalThis as typeof globalThis & { __zudomartStudioPayoutOnboarding?: PayoutOnboardingRecord };

const blank = (): PayoutOnboardingState => ({
  role: "creator", status: "not_started", currentStep: "identity", completedSteps: [], requiresBusinessStep: false, requiresDocumentStep: false, legalName: null, idType: null, idLast4: null,
  bankSummary: null, documentStatus: "not_started", accountStatus: null, syncByStep: {}, earningsPendingTransfer: { amountMinor: 0, currency: "NGN" }, pendingWithdrawable: { amountMinor: 1_250_000, currency: "NGN" }, reviewEstimate: null, reasons: [], verifiedVia: null,
  withdrawalsEnabled: false, firstEarningsUnlockAt: null,
});

function read(): PayoutOnboardingRecord {
  return (holder.__zudomartStudioPayoutOnboarding ??= { state: blank(), idNumber: "", legalName: "", identitySavedAt: null, creationFailed: false, submittedAt: null, linkFailedOnce: false });
}

const normalize = (name: string) => name.toUpperCase().replace(/[^A-Z ]/g, "").split(/\s+/).filter(Boolean).sort().join(" ");

function settle(record: PayoutOnboardingRecord): PayoutOnboardingState {
  let { state } = record;
  if (state.accountStatus === "pending_creation" && record.identitySavedAt !== null && Date.now() - record.identitySavedAt > CREATION_DELAY_MS) {
    state = { ...state, accountStatus: record.creationFailed ? "failed" : "documentsRequired" };
  }
  if (state.status === "pending_review" && record.submittedAt !== null && Date.now() - record.submittedAt > REVIEW_DELAY_MS) {
    state = record.idNumber.endsWith("0000")
      ? { ...state, status: "action_needed", accountStatus: "actionRequired", currentStep: "identity", completedSteps: state.completedSteps.filter((step) => step !== "identity" && step !== "document"), documentStatus: "rejected", reasons: [
          { step: "identity", code: "ID_NAME_MISMATCH", message: "The name on your ID does not match the legal name you entered. Check the spelling and re-enter your ID number." },
          { step: "document", code: "DOCUMENT_UNREADABLE", message: "Your ID photo was blurry. Upload a clear photo of all four corners." }] }
      : { ...state, status: "verified", accountStatus: "verified", documentStatus: "approved", verifiedVia: "creator", withdrawalsEnabled: true, reasons: [] };
  }
  const syncByStep: PayoutOnboardingState["syncByStep"] = {};
  state.completedSteps.forEach((step) => {
    syncByStep[step] = !state.accountStatus ? "saved" : state.accountStatus === "failed" ? "needs_attention" : state.accountStatus === "pending_creation" ? "sending" : step === "document" && state.documentStatus === "rejected" ? "needs_attention" : "done";
  });
  record.state = { ...state, syncByStep };
  return record.state;
}

function advance(record: PayoutOnboardingRecord, step: PayoutOnboardingStep, patch: Partial<PayoutOnboardingState>): PayoutOnboardingState {
  const completedSteps = Array.from(new Set([...record.state.completedSteps, step]));
  const requiresBusiness = patch.requiresBusinessStep ?? record.state.requiresBusinessStep;
  const order: PayoutOnboardingStep[] = ["identity", ...(requiresBusiness ? (["business"] as const) : []), "bank", ...(record.state.requiresDocumentStep ? (["document"] as const) : [])];
  const currentStep = order.find((candidate) => !completedSteps.includes(candidate)) ?? "bank";
  record.state = { ...record.state, ...patch, completedSteps, currentStep, status: "in_progress", reasons: [] };
  return settle(record);
}

function guard(record: PayoutOnboardingRecord, step: PayoutOnboardingStep): void {
  if (record.state.status === "verified") throw new ApiError(409, "Your payout details are already verified.", "ALREADY_VERIFIED");
  if (record.state.status === "pending_review") throw new ApiError(409, "Your details are in review. We'll tell you if anything is needed.", "IN_REVIEW");
  if (step !== "identity" && !record.state.completedSteps.includes("identity")) throw new ApiError(409, "Start with your personal details.", "STEP_ORDER");
}

const ok = <T,>(value: T) => value;

export const payoutOnboardingMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/banks", () => ({ nextCursor: null, data: [
    { code: "044", name: "Access Bank" }, { code: "058", name: "Guaranty Trust Bank" }, { code: "011", name: "First Bank of Nigeria" }, { code: "033", name: "United Bank for Africa" },
    { code: "057", name: "Zenith Bank" }, { code: "50515", name: "Moniepoint MFB" }, { code: "999992", name: "OPay" }, { code: "999991", name: "PalmPay" },
  ].map((bank) => ({ ...bank, countryCode: "NG" })) })),
  createMockRoute("GET", "/api/v1/payments/payout-onboarding/me", () => settle(read())),

  createMockRoute("GET", "/api/v1/payments/payout-fees", () => {
    return ok({ currency: "NGN", kind: "flat", fee: { amountMinor: 5000, currency: "NGN" }, arrivalEstimate: "Withdrawals to Nigerian banks usually arrive within minutes.", firstPayoutNote: "Your very first withdrawal is held for one quick safety review before it is sent." });
  }),

  createMockRoute("PUT", "/api/v1/payments/payout-onboarding/me/identity", ({ body: requestBody }) => {
    const record = read();
    guard(record, "identity");
    const body = ((requestBody ?? {}) as Record<string, unknown>);
    const legalName = String(body.legalName ?? "").trim();
    const idNumber = String(body.idNumber ?? "");
    const dateOfBirth = String(body.dateOfBirth ?? "");
    if (legalName.split(/\s+/).length < 2) throw new ApiError(422, "Enter your first and last name as on your ID.", "INVALID_NAME");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(Date.parse(dateOfBirth))) throw new ApiError(422, "Enter your date of birth as YYYY-MM-DD.", "INVALID_DOB");
    if (Date.now() - Date.parse(dateOfBirth) < 18 * 365.25 * 86_400_000) throw new ApiError(422, "You must be 18 or older to receive payouts.", "UNDERAGE");
    if (!/^\d{11}$/.test(idNumber)) throw new ApiError(422, "BVN and NIN numbers have 11 digits.", "INVALID_ID");
    record.idNumber = idNumber;
    record.legalName = legalName;
    if (record.identitySavedAt === null || record.state.accountStatus === "actionRequired") record.identitySavedAt = Date.now();
    record.creationFailed = idNumber.startsWith("99");
    return ok(advance(record, "identity", { legalName, idType: body.idType === "nin" ? "nin" : "bvn", idLast4: idNumber.slice(-4), requiresBusinessStep: body.registeredBusiness === true, accountStatus: record.state.accountStatus === "actionRequired" ? "documentsRequired" : record.state.accountStatus ?? "pending_creation" }));
  }),

  createMockRoute("PUT", "/api/v1/payments/payout-onboarding/me/business", ({ body: requestBody }) => {
    const record = read();
    guard(record, "business");
    if (!/^(RC|BN)\d{6,8}$/i.test(String(((requestBody ?? {}) as Record<string, unknown>).cacNumber ?? "").trim())) throw new ApiError(422, "CAC numbers look like RC1234567 or BN1234567.", "INVALID_CAC");
    return ok(advance(record, "business", {}));
  }),

  createMockRoute("POST", "/api/v1/payments/payout-onboarding/me/resolve", ({ body: requestBody }) => {
    const record = read();
    const body = ((requestBody ?? {}) as Record<string, unknown>);
    const accountNumber = String(body.accountNumber ?? "");
    if (!/^\d{10}$/.test(accountNumber)) throw new ApiError(422, "Account numbers have 10 digits.", "INVALID_ACCOUNT");
    if (accountNumber.startsWith("000")) throw new ApiError(404, "We couldn't find that account. Check the number and bank.", "ACCOUNT_NOT_FOUND");
    const fallbackName = record.legalName || "Creator";
    return ok({ accountName: accountNumber.startsWith("111") ? "CHUKWUEMEKA OBI" : fallbackName.toUpperCase() });
  }),

  createMockRoute("PUT", "/api/v1/payments/payout-onboarding/me/bank", ({ body: requestBody }) => {
    const record = read();
    guard(record, "bank");
    const body = ((requestBody ?? {}) as Record<string, unknown>);
    if (normalize(String(body.resolvedAccountName ?? "")) !== normalize(record.legalName)) throw new ApiError(422, "The account name must match your legal name.", "NAME_MISMATCH");
    const advanced = advance(record, "bank", { bankSummary: { bankName: String(body.bankName ?? "Bank"), accountLast4: String(body.accountNumber ?? "").slice(-4), accountName: String(body.resolvedAccountName ?? "") } });
    if (record.state.requiresDocumentStep) return ok(advanced);
    record.submittedAt = Date.now();
    record.state = { ...record.state, status: "pending_review", accountStatus: "underReview", reviewEstimate: "up to 24 hours" };
    return ok(record.state);
  }),

  createMockRoute("POST", "/api/v1/payments/payout-onboarding/me/retry", () => {
    const record = read();
    if (settle(record).accountStatus === "failed") {
      record.creationFailed = false;
      record.identitySavedAt = Date.now() - CREATION_DELAY_MS + 2_000;
      record.state = { ...record.state, accountStatus: "pending_creation" };
    }
    return ok(settle(record));
  }),

  createMockRoute("POST", "/api/v1/payments/payout-onboarding/me/document-link", () => {
    const record = read();
    guard(record, "document");
    if (record.idNumber.endsWith("5030") && !record.linkFailedOnce) {
      record.linkFailedOnce = true;
      throw new ApiError(503, "We couldn't open the verification page right now. Try again in a moment.", "LINK_UNAVAILABLE");
    }
    if (settle(record).accountStatus !== "documentsRequired") throw new ApiError(409, "Your payout account is still being set up. We'll tell you when it's ready.", "ACCOUNT_NOT_READY");
    record.state = { ...record.state, documentStatus: "link_issued" };
    return ok({ url: "/earnings?verification=mock", returnUrl: "/earnings?verification=returned", expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() });
  }),

  createMockRoute("POST", "/api/v1/payments/payout-onboarding/me/document-link/complete", () => {
    const record = read();
    if (record.state.documentStatus !== "link_issued") throw new ApiError(409, "Open the verification page first.", "NO_LINK");
    record.submittedAt = Date.now();
    record.state = { ...record.state, status: "pending_review", accountStatus: "underReview", reviewEstimate: "up to 24 hours", documentStatus: "uploaded", completedSteps: [...record.state.completedSteps, "document"], reasons: [] };
    return ok(settle(record));
  }),
];
