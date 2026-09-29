import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { failConflict, failNotFound, matchesSearchText, paginateItems, readJsonObjectBody, readOptionalTrimmedString, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { CoinTransactionStatus } from "@/types/payouts.type";

import type { MockCoinRecord } from "./moneyRecords.mock";
import { presentCoinTransaction } from "./moneyPresenters.mock";
import { postMockLedgerJournal, readMockMoneyStore, readUserSearchableText, requireIdempotencyKeyHeader } from "./moneyStore.mock";
import { readPageFilterValue } from "./moneyValidation.mock";

const coinStatuses: readonly CoinTransactionStatus[] = ["PENDING_REVIEW", "REVIEWED", "REVERSED"];

function findMockCoinTransactionOrFail(transactionId: string): MockCoinRecord {
  const coin = readMockMoneyStore().coinTransactions.find((candidate) => candidate.id === transactionId);
  if (!coin) failNotFound("Coin transaction");
  return coin;
}

function presentCoinDetail(coin: MockCoinRecord) {
  return { ...presentCoinTransaction(coin), history: listMockAuditEntriesForTarget("coinTransaction", coin.id) };
}

const auditTargetForCoin = (coin: MockCoinRecord) => ({ type: "coinTransaction", id: coin.id, label: `${coin.kind.toLowerCase()} · ${coin.coins.toLocaleString("en-NG")} coins` });

export function registerCoinMockHandlers(): void {
  registerMockRoute("GET", "/admin/coins", (request) => {
    requireMockPermission(request, "coins:review");
    const store = readMockMoneyStore();
    const status = readPageFilterValue(request, "status");
    const kind = readPageFilterValue(request, "kind");
    const search = request.query.get("search");
    const coins = store.coinTransactions
      .filter((coin) => (!status || coin.status === status) && (!kind || coin.kind === kind))
      .filter((coin) => matchesSearchText(search, coin.id, coin.context, readUserSearchableText(coin.senderId), coin.receiverId ? readUserSearchableText(coin.receiverId) : ""))
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
      .map(presentCoinTransaction);
    const counts = Object.fromEntries(coinStatuses.map((candidate) => [candidate, store.coinTransactions.filter((coin) => coin.status === candidate).length]));
    return respondWithJson(200, { ...paginateItems(coins, request), counts });
  });

  registerMockRoute("GET", "/admin/coins/:transactionId", (request) => {
    requireMockPermission(request, "coins:review");
    return respondWithJson(200, presentCoinDetail(findMockCoinTransactionOrFail(request.params.transactionId ?? "")));
  });

  registerMockRoute("POST", "/admin/coins/:transactionId/mark-reviewed", (request) => {
    requireMockPermission(request, "coins:review");
    const coin = findMockCoinTransactionOrFail(request.params.transactionId ?? "");
    if (coin.status !== "PENDING_REVIEW") failConflict("COIN_TRANSACTION_NOT_PENDING", "This transaction is not waiting for review.");
    const note = readOptionalTrimmedString(readJsonObjectBody(request), "reason", 1000);
    coin.status = "REVIEWED";
    recordMockAuditEntry(request, { action: "coins.reviewed", area: "commerce", target: auditTargetForCoin(coin), reason: note, before: { status: "PENDING_REVIEW" }, after: { status: coin.status } });
    return respondWithJson(200, presentCoinDetail(coin));
  });

  registerMockRoute("POST", "/admin/coins/:transactionId/reverse", (request) => {
    requireMockPermission(request, "coins:review");
    requireMockStepUp(request);
    requireIdempotencyKeyHeader(request.headers);
    const coin = findMockCoinTransactionOrFail(request.params.transactionId ?? "");
    if (coin.status === "REVERSED") failConflict("COIN_TRANSACTION_REVERSED", "This transaction was already reversed.");
    const reason = readRequiredReason(readJsonObjectBody(request));
    const before = { status: coin.status };
    coin.status = "REVERSED";
    const reference = { type: "COIN" as const, id: coin.id, label: `Reversal: ${coin.context}` };
    if (coin.kind === "PURCHASE") {
      postMockLedgerJournal(readMockMoneyStore(), { currency: coin.currency, description: "Coin purchase reversed and refunded", reference, legs: [{ accountId: "coin_float", direction: "DEBIT", amountMinor: coin.fiatMinor }, { accountId: "provider_clearing", direction: "CREDIT", amountMinor: coin.fiatMinor }] });
    } else {
      const feeMinor = Math.round((coin.fiatMinor * (coin.feeBasisPoints ?? 0)) / 10_000);
      postMockLedgerJournal(readMockMoneyStore(), { currency: coin.currency, description: `Platform fee returned on reversed ${coin.kind.toLowerCase()}`, reference, legs: [{ accountId: "coin_fees", direction: "DEBIT", amountMinor: feeMinor }, { accountId: "coin_float", direction: "CREDIT", amountMinor: feeMinor }] });
    }
    recordMockAuditEntry(request, { action: "coins.reversed", area: "commerce", target: auditTargetForCoin(coin), reason, before, after: { status: coin.status, coins: coin.coins, fiatValue: { amountMinor: coin.fiatMinor, currency: coin.currency } } });
    return respondWithJson(200, presentCoinDetail(coin));
  });
}
