import type { PayoutAccountInput, WithdrawalRequest } from "@/types/account.type";
import type { PayoutAccount, WalletSummary, WalletTransaction } from "@/types";
import { ApiError } from "@/errors/api.error";

import { isoDateHoursAgo } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

let wallet: WalletSummary = { available: 12_500_000, pending: 2_000_000, currency: "NGN" };

let transactions: WalletTransaction[] = [
  { id: "t_1", kind: "credit", amount: 2_000_000, description: "Escrow released · Order #ZM1042", createdAt: isoDateHoursAgo(3), status: "completed" },
  { id: "t_2", kind: "debit", amount: 5_000_000, description: "Withdrawal to GTBank ••••4821", createdAt: isoDateHoursAgo(30), status: "completed" },
  { id: "t_3", kind: "credit", amount: 2_000_000, description: "Escrow pending · Order #ZM1043", createdAt: isoDateHoursAgo(50), status: "pending" },
];

let payoutAccounts: PayoutAccount[] = [
  { id: "pa_1", bankName: "GTBank", accountNumberMasked: "••••4821", accountName: "ENYO DEV" },
];

const seenIdempotencyKeys = new Set<string>();

export const walletMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/wallets/me", () => wallet),
  createMockRoute("GET", "/api/v1/wallets/me/transactions", () => transactions),
  createMockRoute("GET", "/api/v1/wallets/me/payout-accounts", () => payoutAccounts),
  createMockRoute("POST", "/api/v1/wallets/me/payout-accounts", ({ body }) => {
    const { accountNumber } = body as PayoutAccountInput;
    const account: PayoutAccount = {
      id: `pa_${Date.now()}`,
      bankName: "Access Bank",
      accountNumberMasked: `••••${accountNumber.slice(-4)}`,
      accountName: "ENYO DEV",
    };
    payoutAccounts = [...payoutAccounts, account];
    return account;
  }),
  createMockRoute("DELETE", "/api/v1/wallets/me/payout-accounts/:payoutAccountId", ({ params }) => {
    payoutAccounts = payoutAccounts.filter((a) => a.id !== params.payoutAccountId);
  }),
  createMockRoute("POST", "/api/v1/wallets/me/withdrawals", ({ body }) => {
    const { amount, payoutAccountId } = body as WithdrawalRequest;
    if (amount > wallet.available) throw new ApiError(422, "Amount is more than your available balance");
    const account = payoutAccounts.find((a) => a.id === payoutAccountId);
    const key = `${payoutAccountId}:${amount}:${transactions.length}`;
    if (seenIdempotencyKeys.has(key)) return transactions[0];
    seenIdempotencyKeys.add(key);
    wallet = { ...wallet, available: wallet.available - amount };
    const transaction: WalletTransaction = {
      id: `t_${Date.now()}`,
      kind: "debit",
      amount,
      description: `Withdrawal to ${account?.bankName ?? "bank"} ${account?.accountNumberMasked ?? ""}`.trim(),
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    transactions = [transaction, ...transactions];
    return transaction;
  }),
];
