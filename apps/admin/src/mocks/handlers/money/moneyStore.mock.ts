import { findMockPlatformUser, readMockAreaStore } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockId, readIsoNow } from "@/mocks/mockResponses.mock";
import { buildDemoDisputes, buildDemoRefunds } from "@/mocks/seed/moneyDisputes.mock";
import { buildDemoOrders, calculateOrderTotalInMinorUnits } from "@/mocks/seed/moneyOrders.mock";
import { buildDemoCoinTransactions, buildDemoPayouts } from "@/mocks/seed/moneyPayouts.mock";
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
    provider_clearing: { name: "Payment provider clearing", kind: "ASSET" },
    escrow_holding: { name: "Escrow holding", kind: "LIABILITY" },
    platform_commission: { name: "Escrow fees", kind: "REVENUE" },
    coin_float: { name: "Coins in circulation", kind: "LIABILITY" },
    coin_fees: { name: "Coin transfer and gift fees", kind: "REVENUE" },
  };
  if (prefix === "user_wallet") return { name: `Wallet · @${findMockPlatformUser(middle)?.username ?? middle}`, kind: "LIABILITY", ownerUserId: middle };
  const definition = definitions[prefix] ?? { name: prefix, kind: "ASSET" as const };
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
    payouts: buildDemoPayouts(),
    coinTransactions: buildDemoCoinTransactions(),
    ledgerAccounts: new Map(),
    journals: [],
  };
  for (const order of store.orders) postSeedJournalsForOrder(store, order);
  for (const payout of store.payouts.filter((candidate) => candidate.status === "PAID" || candidate.status === "APPROVED")) {
    postMockLedgerJournal(store, { currency: payout.currency, occurredAt: payout.requestedAt, description: `Withdrawal to ${payout.destination.institutionName} ${payout.destination.accountMasked}`, reference: { type: "PAYOUT", id: payout.id, label: payout.id }, legs: [{ accountId: `user_wallet:${payout.userId}`, direction: "DEBIT", amountMinor: payout.amountMinor }, { accountId: "provider_clearing", direction: "CREDIT", amountMinor: payout.amountMinor }] });
  }
  for (const coin of store.coinTransactions.filter((candidate) => candidate.status !== "REVERSED")) {
    const reference = { type: "COIN" as const, id: coin.id, label: coin.context };
    if (coin.kind === "PURCHASE") {
      postMockLedgerJournal(store, { currency: coin.currency, occurredAt: coin.createdAt, description: `Coin purchase: ${coin.coins.toLocaleString("en-NG")} coins`, reference, legs: [{ accountId: "provider_clearing", direction: "DEBIT", amountMinor: coin.fiatMinor }, { accountId: "coin_float", direction: "CREDIT", amountMinor: coin.fiatMinor }] });
    } else {
      const feeMinor = Math.round((coin.fiatMinor * (coin.feeBasisPoints ?? 0)) / 10_000);
      postMockLedgerJournal(store, { currency: coin.currency, occurredAt: coin.createdAt, description: `Platform fee on coin ${coin.kind.toLowerCase()}`, reference, legs: [{ accountId: "coin_float", direction: "DEBIT", amountMinor: feeMinor }, { accountId: "coin_fees", direction: "CREDIT", amountMinor: feeMinor }] });
    }
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
