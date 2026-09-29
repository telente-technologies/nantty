import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { findMockPlatformUser } from "@/mocks/mockDatabase.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { failConflict, failNotFound, matchesSearchText, paginateItems, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { PayoutStatus } from "@/types/payouts.type";

import type { MockPayoutRecord } from "./moneyRecords.mock";
import { presentPayout } from "./moneyPresenters.mock";
import { postMockLedgerJournal, readMockMoneyStore, readUserSearchableText, requireIdempotencyKeyHeader } from "./moneyStore.mock";
import { readPageFilterValue } from "./moneyValidation.mock";

const payoutStatuses: readonly PayoutStatus[] = ["PENDING", "ON_HOLD", "APPROVED", "REJECTED", "PAID"];

function findMockPayoutOrFail(payoutId: string): MockPayoutRecord {
  const payout = readMockMoneyStore().payouts.find((candidate) => candidate.id === payoutId);
  if (!payout) failNotFound("Payout");
  return payout;
}

function presentPayoutDetail(payout: MockPayoutRecord) {
  const recentPayouts = readMockMoneyStore()
    .payouts.filter((candidate) => candidate.userId === payout.userId && candidate.id !== payout.id)
    .map((candidate) => ({ id: candidate.id, amount: { amountMinor: candidate.amountMinor, currency: candidate.currency }, status: candidate.status, requestedAt: candidate.requestedAt }));
  return { ...presentPayout(payout), recentPayouts, history: listMockAuditEntriesForTarget("payout", payout.id) };
}

function changePayoutStatus(request: MockRequest, nextStatus: "APPROVED" | "ON_HOLD" | "REJECTED") {
  const payout = findMockPayoutOrFail(request.params.payoutId ?? "");
  const allowedFrom: readonly PayoutStatus[] = nextStatus === "ON_HOLD" ? ["PENDING"] : ["PENDING", "ON_HOLD"];
  if (!allowedFrom.includes(payout.status)) failConflict("PAYOUT_NOT_ACTIONABLE", `A ${payout.status.toLowerCase().replace("_", " ")} payout cannot be changed.`);
  const reason = readRequiredReason(readJsonObjectBody(request));
  const before = { status: payout.status };
  payout.status = nextStatus;
  if (nextStatus === "APPROVED") {
    postMockLedgerJournal(readMockMoneyStore(), {
      currency: payout.currency,
      description: `Withdrawal to ${payout.destination.institutionName} ${payout.destination.accountMasked}`,
      reference: { type: "PAYOUT", id: payout.id, label: payout.id },
      legs: [{ accountId: `user_wallet:${payout.userId}`, direction: "DEBIT", amountMinor: payout.amountMinor }, { accountId: "provider_clearing", direction: "CREDIT", amountMinor: payout.amountMinor }],
    });
  }
  const actionName = nextStatus === "APPROVED" ? "payout.approved" : nextStatus === "ON_HOLD" ? "payout.held" : "payout.rejected";
  recordMockAuditEntry(request, {
    action: actionName,
    area: "commerce",
    target: { type: "payout", id: payout.id, label: `${payout.id} · @${findMockPlatformUser(payout.userId)?.username ?? payout.userId}` },
    reason,
    before,
    after: { status: payout.status, amount: { amountMinor: payout.amountMinor, currency: payout.currency }, fraudScore: payout.fraud.score },
  });
  return respondWithJson(200, presentPayoutDetail(payout));
}

export function registerPayoutMockHandlers(): void {
  registerMockRoute("GET", "/admin/payouts", (request) => {
    requireMockPermission(request, "payouts:approve");
    const store = readMockMoneyStore();
    const status = readPageFilterValue(request, "status");
    const search = request.query.get("search");
    const payouts = store.payouts
      .filter((payout) => (!status || payout.status === status) && matchesSearchText(search, payout.id, readUserSearchableText(payout.userId), payout.destination.institutionName))
      .sort((first, second) => second.fraud.score - first.fraud.score || first.requestedAt.localeCompare(second.requestedAt))
      .map(presentPayout);
    const counts = Object.fromEntries(payoutStatuses.map((candidate) => [candidate, store.payouts.filter((payout) => payout.status === candidate).length]));
    return respondWithJson(200, { ...paginateItems(payouts, request), counts });
  });

  registerMockRoute("GET", "/admin/payouts/:payoutId", (request) => {
    requireMockPermission(request, "payouts:approve");
    return respondWithJson(200, presentPayoutDetail(findMockPayoutOrFail(request.params.payoutId ?? "")));
  });

  registerMockRoute("POST", "/admin/payouts/:payoutId/approve", (request) => {
    requireMockPermission(request, "payouts:approve");
    requireMockStepUp(request);
    requireIdempotencyKeyHeader(request.headers);
    return changePayoutStatus(request, "APPROVED");
  });

  registerMockRoute("POST", "/admin/payouts/:payoutId/hold", (request) => {
    requireMockPermission(request, "payouts:approve");
    return changePayoutStatus(request, "ON_HOLD");
  });

  registerMockRoute("POST", "/admin/payouts/:payoutId/reject", (request) => {
    requireMockPermission(request, "payouts:approve");
    return changePayoutStatus(request, "REJECTED");
  });
}
