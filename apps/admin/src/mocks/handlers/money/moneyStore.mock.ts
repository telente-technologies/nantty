import { findMockPlatformUser, readMockAreaStore } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockId, readIsoNow } from "@/mocks/mockResponses.mock";
import { buildDemoDisputes, buildDemoRefunds } from "@/mocks/seed/moneyDisputes.mock";
import { buildDemoOrders, calculateOrderTotalInMinorUnits } from "@/mocks/seed/moneyOrders.mock";
import { buildDemoCoinTransactions, buildDemoWithdrawals } from "@/mocks/seed/moneyPayouts.mock";
import type { LedgerAccountKind } from "@/types/ledger.type";

import type { MockJournalLegRecord, MockJournalRecord, MockLedgerAccountRecord, MockMoneyStore, MockOrderRecord } from "./moneyRecords.mock";

export function readUserDisplayNameOrUnknown(userId: string): string {
  return findMockPlatformUser(userId)?.displayName ?? "Unknown user";
}

export function readUserSearchableText(userId: string): string {
  const user = findMockPlatformUser(userId);
  return user ? `${user.displayName} ${user.username} @${user.username}` : userId;
}

export function calculateCommissionInMinorUnits(sellerPortionMinor: number, commissionBasisPoints: number): number {
  return Math.round((sellerPortionMinor * commissionBasisPoints) / 10_000);
}

export function calculateOrderTotalMinor(order: MockOrderRecord): number {
  return calculateOrderTotalInMinorUnits(order);
}

export function calculateEscrowHeldMinor(order: MockOrderRecord): number {
  if (order.escrowStatus === "RELEASED" || order.escrowStatus === "REFUNDED" || order.escrowStatus === "PARTIALLY_REFUNDED") return 0;
  return calculateOrderTotalMinor(order) - order.refundedMinor;
}

function describeLedgerAccount(accountId: string): Omit<MockLedgerAccountRecord, "id" | "currency"> {
  const [prefix = "", middle = ""] = accountId.split(":");
  const definitions: Record<string, { name: string; kind: LedgerAccountKind }> = {
    provider_clearing: { name: "Payment provider clearing", kind: "asset" },
    escrow_holding: { name: "Escrow holding", kind: "liability" },
    platform_commission: { name: "Escrow fees", kind: "revenue" },
    coin_float: { name: "Coins in circulation", kind: "liability" },
    coin_fees: { name: "Coin transfer and gift fees", kind: "revenue" },
  };
  if (prefix === "user_wallet") return { name: `Wallet · @${findMockPlatformUser(middle)?.username ?? middle}`, kind: "liability", ownerUserId: middle };
  const definition = definitions[prefix] ?? { name: prefix, kind: "asset" as const };
  return { ...definition, ownerUserId: null };
}

export function postMockLedgerJournal(store: MockMoneyStore, journal: Omit<MockJournalRecord, "id" | "occurredAt"> & { readonly occurredAt?: string }): MockJournalRecord {
  const legs: MockJournalLegRecord[] = journal.legs.filter((leg) => leg.amountMinor > 0).map((leg) => ({ ...leg, accountId: `${leg.accountId}:${journal.currency}` }));
  for (const leg of legs) {
    if (!store.ledgerAccounts.has(leg.accountId)) store.ledgerAccounts.set(leg.accountId, { id: leg.accountId, currency: journal.currency, ...describeLedgerAccount(leg.accountId) });
  }
  const record: MockJournalRecord = { ...journal, id: createMockId("jnl"), occurredAt: journal.occurredAt ?? readIsoNow(), legs };
  store.journals.unshift(record);
  return record;
}

function postSeedJournalsForOrder(store: MockMoneyStore, order: MockOrderRecord): void {
  const totalMinor = calculateOrderTotalMinor(order);
  const reference = { type: "ORDER" as const, id: order.id, label: order.orderNumber };
  const occurredAt = order.timeline[0]?.occurredAt ?? order.placedAt;
  const settledAt = order.timeline[order.timeline.length - 1]?.occurredAt ?? occurredAt;
  postMockLedgerJournal(store, { currency: order.currency, occurredAt, description: `Buyer payment into escrow for ${order.orderNumber}`, reference, legs: [{ accountId: "provider_clearing", direction: "DEBIT", amountMinor: totalMinor }, { accountId: "escrow_holding", direction: "CREDIT", amountMinor: totalMinor }] });
  if (order.refundedMinor > 0) {
    postMockLedgerJournal(store, { currency: order.currency, occurredAt: settledAt, description: `Refund to buyer for ${order.orderNumber}`, reference, legs: [{ accountId: "escrow_holding", direction: "DEBIT", amountMinor: order.refundedMinor }, { accountId: "provider_clearing", direction: "CREDIT", amountMinor: order.refundedMinor }] });
  }
  const releasedMinor = order.escrowStatus === "RELEASED" || order.escrowStatus === "PARTIALLY_REFUNDED" ? totalMinor - order.refundedMinor : 0;
  if (releasedMinor > 0) {
    const commissionMinor = calculateCommissionInMinorUnits(releasedMinor, order.commissionBasisPoints);
    postMockLedgerJournal(store, {
      currency: order.currency,
      occurredAt: settledAt,
      description: `Escrow release to seller for ${order.orderNumber}`,
      reference,
      legs: [
        { accountId: "escrow_holding", direction: "DEBIT", amountMinor: releasedMinor },
        { accountId: `user_wallet:${order.sellerId}`, direction: "CREDIT", amountMinor: releasedMinor - commissionMinor },
        { accountId: "platform_commission", direction: "CREDIT", amountMinor: commissionMinor },
      ],
    });
  }
}

function createInitialMoneyStore(): MockMoneyStore {
  const store: MockMoneyStore = {
    orders: buildDemoOrders(readUserDisplayNameOrUnknown),
    disputes: buildDemoDisputes(),
    refunds: buildDemoRefunds(),
    withdrawals: buildDemoWithdrawals(),
    coinTransactions: buildDemoCoinTransactions(),
    ledgerAccounts: new Map(),
    journals: [],
  };
  for (const order of store.orders) postSeedJournalsForOrder(store, order);
  for (const withdrawal of store.withdrawals.filter((candidate) => candidate.withdrawalStatus === "paid" || candidate.withdrawalStatus === "queued")) {
    postMockLedgerJournal(store, { currency: withdrawal.currency, occurredAt: withdrawal.createdAt, description: `Withdrawal to ${withdrawal.destination.bankName} ••••${withdrawal.destination.accountLast4}`, reference: { type: "PAYOUT", id: withdrawal.id, label: withdrawal.reference }, legs: [{ accountId: `user_wallet:${withdrawal.userId}`, direction: "DEBIT", amountMinor: withdrawal.amountMinor }, { accountId: "provider_clearing", direction: "CREDIT", amountMinor: withdrawal.amountMinor }] });
  }
  for (const coin of store.coinTransactions.filter((candidate) => candidate.kind === "purchase" && candidate.fiatMinor !== null && candidate.reviewStatus !== "reversed")) {
    postMockLedgerJournal(store, { currency: coin.currency, occurredAt: coin.createdAt, description: `Coin purchase: ${coin.coins.toLocaleString("en-NG")} coins`, reference: { type: "COIN", id: coin.id, label: coin.reference ?? coin.id }, legs: [{ accountId: "provider_clearing", direction: "DEBIT", amountMinor: coin.fiatMinor ?? 0 }, { accountId: "coin_float", direction: "CREDIT", amountMinor: coin.fiatMinor ?? 0 }] });
  }
  store.journals.sort((first, second) => second.occurredAt.localeCompare(first.occurredAt));
  return store;
}

export function readMockMoneyStore(): MockMoneyStore {
  return readMockAreaStore("money", createInitialMoneyStore);
}

export function requireIdempotencyKeyHeader(headers: Headers): void {
  const key = headers.get("idempotency-key") ?? "";
  if (key.length < 8 || key.length > 128) throw new MockHttpError(400, "IDEMPOTENCY_KEY_REQUIRED", "Money-moving requests need an Idempotency-Key header.");
}
