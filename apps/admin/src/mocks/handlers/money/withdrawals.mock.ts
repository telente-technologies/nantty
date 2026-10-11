import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockSingleUseStepUp } from "@/mocks/mockGuards.mock";
import { failConflict, failNotFound, failValidation, matchesSearchText, paginateByCursor, readIsoNow, readJsonObjectBody, readOptionalTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { WithdrawalDecision, WithdrawalStatus } from "@/types/withdrawals.type";

import type { MockWithdrawalRecord } from "./moneyRecords.mock";
import { presentWithdrawal } from "./moneyPresenters.mock";
import { postMockLedgerJournal, readMockMoneyStore, requireIdempotencyKeyHeader } from "./moneyStore.mock";
import { readPageFilterValue } from "./moneyValidation.mock";
import { compareForQueue, isOldestFirstQueue, withdrawalQueueStatuses } from "@/utils/queueOrder.util";

const withdrawalStatuses: readonly WithdrawalStatus[] = ["pending_review", "on_hold", "queued", "processing", "paid", "failed", "cancelled"];
const allowedFrom: Record<WithdrawalDecision, readonly WithdrawalStatus[]> = { approve: ["pending_review", "on_hold"], reject: ["pending_review", "on_hold"], hold: ["pending_review", "queued"] };

function findMockWithdrawalOrFail(withdrawalId: string): MockWithdrawalRecord {
  const withdrawal = readMockMoneyStore().withdrawals.find((candidate) => candidate.id === withdrawalId);
  if (!withdrawal) failNotFound("Withdrawal");
  return withdrawal;
}

function presentWithdrawalDetail(withdrawal: MockWithdrawalRecord) {
  const recentWithdrawals = readMockMoneyStore()
    .withdrawals.filter((candidate) => candidate.userId === withdrawal.userId && candidate.id !== withdrawal.id)
    .slice(0, 5)
    .map((candidate) => ({ id: candidate.id, amount: { amountMinor: candidate.amountMinor, currency: candidate.currency }, withdrawalStatus: candidate.withdrawalStatus, createdAt: candidate.createdAt }));
  return { ...presentWithdrawal(withdrawal), availableBalance: { amountMinor: withdrawal.availableBalanceMinor, currency: withdrawal.currency }, recentWithdrawals };
}

export function registerWithdrawalMockHandlers(): void {
  registerMockRoute("GET", "/admin/withdrawals", (request) => {
    requireMockPermission(request, "payouts:approve");
    const store = readMockMoneyStore();
    const status = readPageFilterValue(request, "status");
    if (status && !withdrawalStatuses.includes(status as WithdrawalStatus)) failValidation("status", `must be one of ${withdrawalStatuses.join(", ")}`);
    const search = request.query.get("search");
    const withdrawals = store.withdrawals
      .filter((withdrawal) => (!status || withdrawal.withdrawalStatus === status) && matchesSearchText(search, withdrawal.id, withdrawal.userId, withdrawal.reference))
      .sort((first, second) => compareForQueue(first.createdAt, second.createdAt, isOldestFirstQueue(status ? [status] : null, withdrawalQueueStatuses)))
      .map(presentWithdrawal);
    const counts = Object.fromEntries(withdrawalStatuses.map((candidate) => [candidate, store.withdrawals.filter((withdrawal) => withdrawal.withdrawalStatus === candidate).length]));
    return respondWithJson(200, { ...paginateByCursor(withdrawals, request), counts });
  });

  registerMockRoute("GET", "/admin/withdrawals/:withdrawalId", (request) => {
    requireMockPermission(request, "payouts:approve");
    return respondWithJson(200, presentWithdrawalDetail(findMockWithdrawalOrFail(request.params.withdrawalId ?? "")));
  });

  registerMockRoute("POST", "/admin/withdrawals/:withdrawalId/review", (request) => {
    requireMockPermission(request, "payouts:approve");
    requireMockSingleUseStepUp(request);
    requireIdempotencyKeyHeader(request.headers);
    const withdrawal = findMockWithdrawalOrFail(request.params.withdrawalId ?? "");
    const body = readJsonObjectBody(request);
    const decision = body["decision"] as WithdrawalDecision;
    if (!(decision in allowedFrom)) failValidation("decision", "must be one of approve, reject, hold");
    const reason = readOptionalTrimmedString(body, "reason", 300) ?? "";
    if (decision !== "approve" && reason.length < 3) failValidation("reason", "must be between 3 and 300 characters");
    if (!allowedFrom[decision].includes(withdrawal.withdrawalStatus)) failConflict("WITHDRAWAL_NOT_CHANGEABLE", "This withdrawal can no longer be changed.");
    const before = { status: withdrawal.withdrawalStatus };
    const now = readIsoNow();
    withdrawal.reviewedByStaffId = request.principal?.adminId ?? null;
    withdrawal.reviewedAt = now;
    if (decision === "reject") {
      withdrawal.withdrawalStatus = "failed";
      withdrawal.failureReason = `rejected: ${reason}`;
      withdrawal.processedAt = now;
      withdrawal.availableBalanceMinor += withdrawal.amountMinor;
    } else {
      withdrawal.withdrawalStatus = decision === "hold" ? "on_hold" : "queued";
      withdrawal.reviewNote = reason || null;
    }
    if (decision === "approve") {
      postMockLedgerJournal(readMockMoneyStore(), {
        currency: withdrawal.currency,
        description: `Withdrawal to ${withdrawal.destination.bankName} ••••${withdrawal.destination.accountLast4}`,
        reference: { type: "PAYOUT", id: withdrawal.id, label: withdrawal.reference },
        legs: [{ accountId: `user_wallet:${withdrawal.userId}`, direction: "DEBIT", amountMinor: withdrawal.amountMinor }, { accountId: "provider_clearing", direction: "CREDIT", amountMinor: withdrawal.amountMinor }],
      });
    }
    const action = { approve: "withdrawal.approved", reject: "withdrawal.rejected", hold: "withdrawal.held" }[decision];
    recordMockAuditEntry(request, { action, area: "commerce", target: { type: "withdrawal", id: withdrawal.id, label: withdrawal.reference }, reason, before, after: { status: withdrawal.withdrawalStatus, amount: { amountMinor: withdrawal.amountMinor, currency: withdrawal.currency } } });
    return respondWithJson(200, presentWithdrawalDetail(withdrawal));
  });
}
