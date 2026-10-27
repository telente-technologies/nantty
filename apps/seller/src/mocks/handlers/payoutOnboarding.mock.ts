import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, readJsonObjectBody, requireMockStorePrincipal, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
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
const holder = globalThis as typeof globalThis & { __nanttySellerPayoutOnboarding?: Map<string, PayoutOnboardingRecord> };

const blank = (): PayoutOnboardingState => ({
  role: "seller", status: "not_started", currentStep: "identity", completedSteps: [], requiresBusinessStep: false, legalName: null, idType: null, idLast4: null,
  bankSummary: null, documentStatus: "not_started", accountStatus: null, syncByStep: {}, earningsPendingTransfer: true, pendingWithdrawable: { amountMinor: 1_250_000, currency: "NGN" }, reviewEstimate: null, reasons: [], verifiedVia: null,
  withdrawalsEnabled: false, firstEarningsUnlockAt: new Date(Date.now() + 9.5 * 3_600_000).toISOString(),
});

function read(storeId: string): PayoutOnboardingRecord {
  const map = (holder.__nanttySellerPayoutOnboarding ??= new Map());
  if (!map.has(storeId)) map.set(storeId, { state: blank(), idNumber: "", legalName: "", identitySavedAt: null, creationFailed: false, submittedAt: null, linkFailedOnce: false });
  return map.get(storeId) as PayoutOnboardingRecord;
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
      : { ...state, status: "verified", accountStatus: "verified", documentStatus: "approved", verifiedVia: "seller", withdrawalsEnabled: true, reasons: [] };
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
  const order: PayoutOnboardingStep[] = ["identity", ...(requiresBusiness ? (["business"] as const) : []), "bank", "document"];
  const currentStep = order.find((candidate) => !completedSteps.includes(candidate)) ?? "document";
  record.state = { ...record.state, ...patch, completedSteps, currentStep, status: "in_progress", reasons: [] };
  return settle(record);
}

function guard(record: PayoutOnboardingRecord, step: PayoutOnboardingStep): void {
  if (record.state.status === "verified") throw new MockHttpError(409, "ALREADY_VERIFIED", "Your payout details are already verified.");
  if (record.state.status === "pending_review") throw new MockHttpError(409, "IN_REVIEW", "Your details are in review. We'll tell you if anything is needed.");
  if (step !== "identity" && !record.state.completedSteps.includes("identity")) throw new MockHttpError(409, "STEP_ORDER", "Start with your personal details.");
}

export function readMockPayoutOnboardingState(storeId: string): PayoutOnboardingState {
  return settle(read(storeId));
}

export function registerPayoutOnboardingMockHandlers(): void {
  registerMockRoute("GET", "/payments/payout-onboarding/me", (request) => respondWithJson(200, settle(read(requireMockStorePrincipal(request).storeId))));

  registerMockRoute("GET", "/payments/payout-fees", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, { currency: "NGN", kind: "flat", fee: { amountMinor: 5000, currency: "NGN" }, arrivalEstimate: "Withdrawals to Nigerian banks usually arrive within minutes.", firstPayoutNote: "Your very first withdrawal is held for one quick safety review before it is sent." });
  });

  registerMockRoute("PUT", "/payments/payout-onboarding/me/identity", (request) => {
    const record = read(requireMockStorePrincipal(request).storeId);
    guard(record, "identity");
    const body = readJsonObjectBody(request);
    const legalName = String(body.legalName ?? "").trim();
    const idNumber = String(body.idNumber ?? "");
    const dateOfBirth = String(body.dateOfBirth ?? "");
    if (legalName.split(/\s+/).length < 2) throw new MockHttpError(422, "INVALID_NAME", "Enter your first and last name as on your ID.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(Date.parse(dateOfBirth))) throw new MockHttpError(422, "INVALID_DOB", "Enter your date of birth as YYYY-MM-DD.");
    if (Date.now() - Date.parse(dateOfBirth) < 18 * 365.25 * 86_400_000) throw new MockHttpError(422, "UNDERAGE", "You must be 18 or older to receive payouts.");
    if (!/^\d{11}$/.test(idNumber)) throw new MockHttpError(422, "INVALID_ID", "BVN and NIN numbers have 11 digits.");
    record.idNumber = idNumber;
    record.legalName = legalName;
    if (record.identitySavedAt === null || record.state.accountStatus === "actionRequired") record.identitySavedAt = Date.now();
    record.creationFailed = idNumber.startsWith("99");
    return respondWithJson(200, advance(record, "identity", { legalName, idType: body.idType === "nin" ? "nin" : "bvn", idLast4: idNumber.slice(-4), requiresBusinessStep: body.registeredBusiness === true, accountStatus: record.state.accountStatus === "actionRequired" ? "documentsRequired" : record.state.accountStatus ?? "pending_creation" }));
  });

  registerMockRoute("PUT", "/payments/payout-onboarding/me/business", (request) => {
    const record = read(requireMockStorePrincipal(request).storeId);
    guard(record, "business");
    if (!/^(RC|BN)\d{6,8}$/i.test(String(readJsonObjectBody(request).cacNumber ?? "").trim())) throw new MockHttpError(422, "INVALID_CAC", "CAC numbers look like RC1234567 or BN1234567.");
    return respondWithJson(200, advance(record, "business", {}));
  });

  registerMockRoute("POST", "/payments/payout-onboarding/me/resolve", (request) => {
    const record = read(requireMockStorePrincipal(request).storeId);
    const body = readJsonObjectBody(request);
    const accountNumber = String(body.accountNumber ?? "");
    if (!/^\d{10}$/.test(accountNumber)) throw new MockHttpError(422, "INVALID_ACCOUNT", "Account numbers have 10 digits.");
    if (accountNumber.startsWith("000")) throw new MockHttpError(404, "ACCOUNT_NOT_FOUND", "We couldn't find that account. Check the number and bank.");
    const fallbackName = record.legalName || readMockDatabase().settings.name;
    return respondWithJson(200, { accountName: accountNumber.startsWith("111") ? "CHUKWUEMEKA OBI" : fallbackName.toUpperCase() });
  });

  registerMockRoute("PUT", "/payments/payout-onboarding/me/bank", (request) => {
    const record = read(requireMockStorePrincipal(request).storeId);
    guard(record, "bank");
    const body = readJsonObjectBody(request);
    if (normalize(String(body.resolvedAccountName ?? "")) !== normalize(record.legalName)) throw new MockHttpError(422, "NAME_MISMATCH", "The account name must match your legal name.");
    return respondWithJson(200, advance(record, "bank", { bankSummary: `${String(body.bankName ?? "Bank")} ••••${String(body.accountNumber ?? "").slice(-4)}` }));
  });

  registerMockRoute("POST", "/payments/payout-onboarding/me/retry", (request) => {
    const record = read(requireMockStorePrincipal(request).storeId);
    if (settle(record).accountStatus === "failed") {
      record.creationFailed = false;
      record.identitySavedAt = Date.now() - CREATION_DELAY_MS + 2_000;
      record.state = { ...record.state, accountStatus: "pending_creation" };
    }
    return respondWithJson(200, settle(record));
  });

  registerMockRoute("POST", "/payments/payout-onboarding/me/document-link", (request) => {
    const record = read(requireMockStorePrincipal(request).storeId);
    guard(record, "document");
    if (record.idNumber.endsWith("5030") && !record.linkFailedOnce) {
      record.linkFailedOnce = true;
      throw new MockHttpError(503, "LINK_UNAVAILABLE", "We couldn't open the verification page right now. Try again in a moment.");
    }
    if (settle(record).accountStatus !== "documentsRequired") throw new MockHttpError(409, "ACCOUNT_NOT_READY", "Your payout account is still being set up. We'll tell you when it's ready.");
    record.state = { ...record.state, documentStatus: "link_issued" };
    return respondWithJson(200, { url: "/settings/payouts?verification=mock", returnUrl: "/settings/payouts?verification=returned", expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() });
  });

  registerMockRoute("POST", "/payments/payout-onboarding/me/document-link/complete", (request) => {
    const record = read(requireMockStorePrincipal(request).storeId);
    if (record.state.documentStatus !== "link_issued") throw new MockHttpError(409, "NO_LINK", "Open the verification page first.");
    record.submittedAt = Date.now();
    record.state = { ...record.state, status: "pending_review", accountStatus: "underReview", reviewEstimate: "up to 24 hours", documentStatus: "uploaded", completedSteps: [...record.state.completedSteps, "document"], reasons: [] };
    return respondWithJson(200, settle(record));
  });
}
