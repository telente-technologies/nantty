import { registerCoinMockHandlers } from "@/mocks/handlers/money/coins.mock";
import { registerDisputeMockHandlers } from "@/mocks/handlers/money/disputes.mock";
import { registerLedgerMockHandlers } from "@/mocks/handlers/money/ledger.mock";
import { readMockMoneyStore } from "@/mocks/handlers/money/moneyStore.mock";
import { registerOrderAndEscrowMockHandlers } from "@/mocks/handlers/money/ordersAndEscrow.mock";
import { registerRefundMockHandlers } from "@/mocks/handlers/money/refunds.mock";
import { registerWithdrawalMockHandlers } from "@/mocks/handlers/money/withdrawals.mock";
import { registerMockQueueCounter } from "@/mocks/mockQueueCounters.mock";

function findOldestTimestamp(timestamps: readonly string[]): string | null {
  return timestamps.length === 0 ? null : [...timestamps].sort()[0] ?? null;
}

function registerMoneyQueueCounters(): void {
  registerMockQueueCounter({
    key: "disputes",
    label: "Disputes",
    href: "/commerce/disputes",
    readCount: () => {
      const openDisputes = readMockMoneyStore().disputes.filter((dispute) => dispute.status !== "RESOLVED");
      const now = new Date().toISOString();
      return { count: openDisputes.length, oldestAt: findOldestTimestamp(openDisputes.map((dispute) => dispute.openedAt)), breachingSla: openDisputes.filter((dispute) => dispute.slaDueAt < now).length };
    },
  });
  registerMockQueueCounter({
    key: "payouts",
    label: "Payouts to approve",
    href: "/commerce/payouts",
    readCount: () => {
      const waiting = readMockMoneyStore().withdrawals.filter((withdrawal) => withdrawal.withdrawalStatus === "pending_review" || withdrawal.withdrawalStatus === "on_hold");
      const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
      return { count: waiting.length, oldestAt: findOldestTimestamp(waiting.map((withdrawal) => withdrawal.createdAt)), breachingSla: waiting.filter((withdrawal) => withdrawal.createdAt < dayAgo).length };
    },
  });
  registerMockQueueCounter({
    key: "coinReviews",
    label: "Coin reviews",
    href: "/commerce/coins",
    readCount: () => {
      const pending = readMockMoneyStore().coinTransactions.filter((coin) => coin.reviewStatus === "pending_review");
      return { count: pending.length, oldestAt: findOldestTimestamp(pending.map((coin) => coin.createdAt)) };
    },
  });
}

export function registerMoneyMockHandlers(): void {
  registerOrderAndEscrowMockHandlers();
  registerDisputeMockHandlers();
  registerRefundMockHandlers();
  registerWithdrawalMockHandlers();
  registerCoinMockHandlers();
  registerLedgerMockHandlers();
  registerMoneyQueueCounters();
}
