import { ApiError } from "@/errors/api.error";
import type {
  PayoutBankInput, PayoutBusinessInput, PayoutIdentityInput, PayoutOnboardingState, PayoutOnboardingStep, PayoutRole,
} from "@/types/payoutOnboarding.type";

import { signedInUserIsApprovedCreator } from "./creatorFixtures.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

interface PayoutOnboardingRecord {
  state: PayoutOnboardingState;
  idNumber: string;
  submittedAt: number | null;
  identitySavedAt: number | null;
  creationFailed: boolean;
  linkFailedOnce: boolean;
  legalName: string;
}

const REVIEW_DELAY_MS = 12_000;
const CREATION_DELAY_MS = 6_000;
const records = new Map<string, PayoutOnboardingRecord>();

const roleForSignedInUser = (): PayoutRole => {
  const seller = !!getSignedInMockUser().storeId;
  const creator = signedInUserIsApprovedCreator();
  return seller && creator ? "both" : seller ? "seller" : "creator";
};

const blankState = (): PayoutOnboardingState => ({
  role: roleForSignedInUser(),
  status: "not_started",
  currentStep: "identity",
  completedSteps: [],
  requiresBusinessStep: false,
  requiresDocumentStep: false,
  legalName: null,
  idType: null,
  idLast4: null,
  bankSummary: null,
  documentStatus: "not_started",
  accountStatus: null,
  syncByStep: {},
  earningsPendingTransfer: !!getSignedInMockUser().storeId,
  pendingWithdrawable: { amountMinor: 1_250_000, currency: "NGN" },
  reviewEstimate: null,
  reasons: [],
  verifiedVia: null,
  withdrawalsEnabled: false,
  firstEarningsUnlockAt: getSignedInMockUser().storeId ? new Date(Date.now() + 9.5 * 3_600_000).toISOString() : null,
});

const recordForSignedInUser = (): PayoutOnboardingRecord => {
  const id = getSignedInMockUser().id;
  if (!records.has(id)) records.set(id, { state: blankState(), idNumber: "", submittedAt: null, identitySavedAt: null, creationFailed: false, linkFailedOnce: false, legalName: "" });
  return records.get(id)!;
};

const normalizeName = (name: string) => name.toUpperCase().replace(/[^A-Z ]/g, "").split(/\s+/).filter(Boolean).sort().join(" ");

const advance = (record: PayoutOnboardingRecord, step: PayoutOnboardingStep, patch: Partial<PayoutOnboardingState>) => {
  const completed = Array.from(new Set([...record.state.completedSteps, step]));
  const next = ((): PayoutOnboardingStep => {
    const order: PayoutOnboardingStep[] = ["identity", ...(patch.requiresBusinessStep ?? record.state.requiresBusinessStep ? ["business" as const] : []), "bank", ...(record.state.requiresDocumentStep ? ["document" as const] : [])];
    return order.find((candidate) => !completed.includes(candidate)) ?? "bank";
  })();
  record.state = { ...record.state, ...patch, completedSteps: completed, currentStep: next, status: "in_progress", reasons: [] };
  return record.state;
};

const settleAccountCreation = (record: PayoutOnboardingRecord) => {
  if (record.state.accountStatus === "pending_creation" && record.identitySavedAt !== null && Date.now() - record.identitySavedAt > CREATION_DELAY_MS) {
    record.state = { ...record.state, accountStatus: record.creationFailed ? "failed" : "documentsRequired" };
  }
  const { accountStatus, completedSteps, documentStatus } = record.state;
  const accountSyncing = accountStatus === "pending_creation";
  const accountFailed = accountStatus === "failed";
  const syncByStep: PayoutOnboardingState["syncByStep"] = {};
  completedSteps.forEach((step) => {
    syncByStep[step] = accountFailed ? "needs_attention" : accountSyncing || !accountStatus ? "sending" : step === "document" && documentStatus === "rejected" ? "needs_attention" : "done";
  });
  if (!accountStatus) completedSteps.forEach((step) => (syncByStep[step] = "saved"));
  record.state = { ...record.state, syncByStep };
};

const settleReview = (record: PayoutOnboardingRecord) => {
  if (record.state.status !== "pending_review" || record.submittedAt === null || Date.now() - record.submittedAt < REVIEW_DELAY_MS) return;
  const role = record.state.role === "both" ? "seller" : record.state.role;
  if (record.idNumber.endsWith("0000")) {
    record.state = {
      ...record.state,
      status: "action_needed",
      accountStatus: "actionRequired",
      currentStep: "identity",
      completedSteps: record.state.completedSteps.filter((step) => step !== "identity" && step !== "document"),
      documentStatus: "rejected",
      reasons: [
        { step: "identity", code: "ID_NAME_MISMATCH", message: "The name on your ID does not match the legal name you entered. Check the spelling and re-enter your ID number." },
        { step: "document", code: "DOCUMENT_UNREADABLE", message: "Your ID photo was blurry. Upload a clear photo of all four corners." },
      ],
    };
    return;
  }
  record.state = { ...record.state, status: "verified", accountStatus: "verified", documentStatus: "approved", verifiedVia: role, withdrawalsEnabled: true, reasons: [] };
};

const requireStep = (record: PayoutOnboardingRecord, step: PayoutOnboardingStep) => {
  if (record.state.status === "verified") throw new ApiError(409, "Your payout details are already verified.", "ALREADY_VERIFIED");
  if (record.state.status === "pending_review") throw new ApiError(409, "Your details are in review. We'll tell you if anything is needed.", "IN_REVIEW");
  if (step !== "identity" && !record.state.completedSteps.includes("identity")) throw new ApiError(409, "Start with your personal details.", "STEP_ORDER");
};

export const signedInUserCanWithdraw = () => {
  const record = recordForSignedInUser();
  settleReview(record);
  return record.state.withdrawalsEnabled;
};

export const payoutOnboardingMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/payments/payout-onboarding/me", () => {
    const record = recordForSignedInUser();
    settleAccountCreation(record);
    settleReview(record);
    settleAccountCreation(record);
    return record.state;
  }),
  createMockRoute("PUT", "/api/v1/payments/payout-onboarding/me/identity", ({ body }) => {
    const input = body as PayoutIdentityInput;
    const record = recordForSignedInUser();
    requireStep(record, "identity");
    if (input.legalName.trim().split(/\s+/).length < 2) throw new ApiError(422, "Enter your first and last name as on your ID.", "INVALID_NAME");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateOfBirth) || Number.isNaN(Date.parse(input.dateOfBirth))) throw new ApiError(422, "Enter your date of birth as YYYY-MM-DD.", "INVALID_DOB");
    if (Date.now() - Date.parse(input.dateOfBirth) < 18 * 365.25 * 86_400_000) throw new ApiError(422, "You must be 18 or older to receive payouts.", "UNDERAGE");
    if (!/^\d{11}$/.test(input.idNumber)) throw new ApiError(422, `${input.idType.toUpperCase()} numbers have 11 digits.`, "INVALID_ID");
    record.idNumber = input.idNumber;
    record.legalName = input.legalName.trim();
    if (record.identitySavedAt === null || record.state.accountStatus === "actionRequired") record.identitySavedAt = Date.now();
    record.creationFailed = input.idNumber.startsWith("99");
    const requiresBusinessStep = input.registeredBusiness && roleForSignedInUser() !== "creator";
    return advance(record, "identity", { legalName: record.legalName, idType: input.idType, idLast4: input.idNumber.slice(-4), requiresBusinessStep, accountStatus: record.state.accountStatus === "actionRequired" ? "documentsRequired" : record.state.accountStatus ?? "pending_creation" });
  }),
  createMockRoute("PUT", "/api/v1/payments/payout-onboarding/me/business", ({ body }) => {
    const input = body as PayoutBusinessInput;
    const record = recordForSignedInUser();
    requireStep(record, "business");
    if (!/^(RC|BN)\d{6,8}$/i.test(input.cacNumber.trim())) throw new ApiError(422, "CAC numbers look like RC1234567 or BN1234567.", "INVALID_CAC");
    return advance(record, "business", {});
  }),
  createMockRoute("PUT", "/api/v1/payments/payout-onboarding/me/bank", ({ body }) => {
    const input = body as PayoutBankInput;
    const record = recordForSignedInUser();
    requireStep(record, "bank");
    if (normalizeName(input.resolvedAccountName) !== normalizeName(record.legalName)) throw new ApiError(422, "The account name must match your legal name.", "NAME_MISMATCH");
    const advanced = advance(record, "bank", { bankSummary: `${input.bankName} ••••${input.accountNumber.slice(-4)}` });
    if (record.state.requiresDocumentStep) return advanced;
    record.submittedAt = Date.now();
    record.state = { ...record.state, status: "pending_review", accountStatus: "underReview", reviewEstimate: "up to 24 hours" };
    return record.state;
  }),
  createMockRoute("POST", "/api/v1/payments/payout-onboarding/me/document-link", () => {
    const record = recordForSignedInUser();
    requireStep(record, "document");
    settleAccountCreation(record);
    if (record.idNumber.endsWith("5030") && !record.linkFailedOnce) {
      record.linkFailedOnce = true;
      throw new ApiError(503, "We couldn't open the verification page right now. Try again in a moment.", "LINK_UNAVAILABLE");
    }
    if (record.state.accountStatus !== "documentsRequired") throw new ApiError(409, "Your payout account is still being set up. We'll tell you when it's ready.", "ACCOUNT_NOT_READY");
    record.state = { ...record.state, documentStatus: "link_issued" };
    return { url: "https://verify.zudomart.com/payout-id/mock-session", returnUrl: "zudomart://payouts/verification-return", expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() };
  }),
  createMockRoute("POST", "/api/v1/payments/payout-onboarding/me/document-link/complete", () => {
    const record = recordForSignedInUser();
    if (record.state.documentStatus !== "link_issued") throw new ApiError(409, "Open the verification page first.", "NO_LINK");
    record.submittedAt = Date.now();
    record.state = { ...record.state, status: "pending_review", accountStatus: "underReview", reviewEstimate: "up to 24 hours", documentStatus: "uploaded", completedSteps: [...record.state.completedSteps, "document"], reasons: [] };
    return record.state;
  }),
  createMockRoute("POST", "/api/v1/payments/payout-onboarding/me/retry", () => {
    const record = recordForSignedInUser();
    if (record.state.accountStatus === "failed") {
      record.creationFailed = false;
      record.identitySavedAt = Date.now() - CREATION_DELAY_MS + 2_000;
      record.state = { ...record.state, accountStatus: "pending_creation" };
    }
    return record.state;
  }),
  createMockRoute("GET", "/api/v1/payments/payout-fees", () => ({
    currency: "NGN",
    kind: "flat",
    fee: { amountMinor: 5000, currency: "NGN" },
    arrivalEstimate: "Withdrawals to Nigerian banks usually arrive within minutes.",
    firstPayoutNote: "Your very first withdrawal is held for one quick safety review before it is sent.",
  })),
];
