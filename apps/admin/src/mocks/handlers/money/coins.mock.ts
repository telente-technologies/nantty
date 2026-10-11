import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockSingleUseStepUp } from "@/mocks/mockGuards.mock";
import { failConflict, failNotFound, failValidation, matchesSearchText, paginateByCursor, readIsoNow, readJsonObjectBody, readOptionalTrimmedString, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { CoinReviewStatus } from "@/types/coins.type";

import type { MockCoinRecord } from "./moneyRecords.mock";
import { presentCoinTransaction } from "./moneyPresenters.mock";
import { postMockLedgerJournal, readMockMoneyStore, readUserSearchableText, requireIdempotencyKeyHeader } from "./moneyStore.mock";
import { readPageFilterValue } from "./moneyValidation.mock";

const reviewStatuses: readonly CoinReviewStatus[] = ["not_required", "pending_review", "reviewed", "reversed"];

function findMockCoinTransactionOrFail(transactionId: string): MockCoinRecord {
  const coin = readMockMoneyStore().coinTransactions.find((candidate) => candidate.id === transactionId);
  if (!coin) failNotFound("Coin transaction");
  return coin;
}

function presentCoinDetail(coin: MockCoinRecord) {
  const history: { action: string; occurredAt: string; staffId: string | null; note: string | null }[] = [{ action: "created", occurredAt: coin.createdAt, staffId: null, note: null }];
  if (coin.reviewFlags.length > 0) history.push({ action: "flagged", occurredAt: coin.createdAt, staffId: null, note: coin.reviewFlags.join(", ") });
  if (coin.reviewedAt) history.push({ action: coin.reviewStatus, occurredAt: coin.reviewedAt, staffId: coin.reviewedByStaffId, note: coin.reviewNote });
  return { ...presentCoinTransaction(coin), history };
}

const auditTargetForCoin = (coin: MockCoinRecord) => ({ type: "coin_transaction", id: coin.id, label: `${coin.kind} · ${coin.coins.toLocaleString("en-NG")} coins` });

export function registerCoinMockHandlers(): void {
  registerMockRoute("GET", "/admin/coins/transactions", (request) => {
    requireMockPermission(request, "coins:review");
    const store = readMockMoneyStore();
    const status = readPageFilterValue(request, "status");
    const kind = readPageFilterValue(request, "kind");
    if (status && !reviewStatuses.includes(status as CoinReviewStatus)) failValidation("status", `must be one of ${reviewStatuses.join(", ")}`);
    if (kind && kind !== "purchase" && kind !== "transfer") failValidation("kind", "must be one of purchase, transfer");
    const search = request.query.get("search");
    const coins = store.coinTransactions
      .filter((coin) => (!status || coin.reviewStatus === status) && (!kind || coin.kind === kind))
      .filter((coin) => matchesSearchText(search, coin.id, coin.reference, readUserSearchableText(coin.senderId), coin.receiverId ? readUserSearchableText(coin.receiverId) : ""))
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
      .map(presentCoinTransaction);
    const counts = Object.fromEntries(reviewStatuses.map((candidate) => [candidate, store.coinTransactions.filter((coin) => coin.reviewStatus === candidate).length]));
    return respondWithJson(200, { ...paginateByCursor(coins, request), counts });
  });

  registerMockRoute("GET", "/admin/coins/transactions/:transactionId", (request) => {
    requireMockPermission(request, "coins:review");
    return respondWithJson(200, presentCoinDetail(findMockCoinTransactionOrFail(request.params.transactionId ?? "")));
  });

  registerMockRoute("POST", "/admin/coins/transactions/:transactionId/mark-reviewed", (request) => {
    requireMockPermission(request, "coins:review");
    const coin = findMockCoinTransactionOrFail(request.params.transactionId ?? "");
    if (coin.reviewStatus !== "pending_review") failConflict("COIN_TRANSACTION_NOT_PENDING", "This transaction is not waiting for review.");
    const note = readOptionalTrimmedString(readJsonObjectBody(request), "reason", 1000);
    coin.reviewStatus = "reviewed";
    coin.reviewedAt = readIsoNow();
    coin.reviewedByStaffId = request.principal?.adminId ?? null;
    coin.reviewNote = note;
    recordMockAuditEntry(request, { action: "coins.reviewed", area: "commerce", target: auditTargetForCoin(coin), reason: note, before: { reviewStatus: "pending_review" }, after: { reviewStatus: coin.reviewStatus } });
    return respondWithJson(200, presentCoinDetail(coin));
  });

  registerMockRoute("POST", "/admin/coins/transactions/:transactionId/reverse", (request) => {
    requireMockPermission(request, "coins:review");
    requireMockSingleUseStepUp(request);
    requireIdempotencyKeyHeader(request.headers);
    const coin = findMockCoinTransactionOrFail(request.params.transactionId ?? "");
    if (coin.reviewStatus === "reversed") failConflict("COIN_TRANSACTION_REVERSED", "This transaction was already reversed.");
    const reason = readRequiredTrimmedString(readJsonObjectBody(request), "reason", 1000, 3);
    const before = { reviewStatus: coin.reviewStatus, transactionStatus: coin.transactionStatus };
    coin.reviewStatus = "reversed";
    coin.transactionStatus = coin.kind === "purchase" ? "refunded" : "reversed";
    coin.reviewedAt = readIsoNow();
    coin.reviewedByStaffId = request.principal?.adminId ?? null;
    coin.reviewNote = reason;
    if (coin.kind === "purchase" && coin.fiatMinor !== null) {
      postMockLedgerJournal(readMockMoneyStore(), { currency: coin.currency, description: "Coin purchase reversed and refunded", reference: { type: "COIN", id: coin.id, label: coin.reference ?? coin.id }, legs: [{ accountId: "coin_float", direction: "DEBIT", amountMinor: coin.fiatMinor }, { accountId: "provider_clearing", direction: "CREDIT", amountMinor: coin.fiatMinor }] });
    }
    recordMockAuditEntry(request, { action: "coins.reversed", area: "commerce", target: auditTargetForCoin(coin), reason, before, after: { reviewStatus: coin.reviewStatus, transactionStatus: coin.transactionStatus, coins: coin.coins } });
    return respondWithJson(200, presentCoinDetail(coin));
  });
}
