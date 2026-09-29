import type { PayoutAccountInput, WithdrawalRequest } from "@/types/account.type";
import type { Money, PayoutAccount, WalletSummary, WalletTransaction } from "@/types";
import { ApiError } from "@/errors/api.error";

import { isoDateHoursAgo } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const walletMoney = (amountMinor: number): Money => ({ amountMinor, currency: "NGN" });

let wallet: WalletSummary = { available: walletMoney(12_500_000), pending: walletMoney(2_000_000) };

let transactions: WalletTransaction[] = [
  { id: "t_1", kind: "credit", amount: walletMoney(2_000_000), description: "Escrow released · Order #ZM1042", createdAt: isoDateHoursAgo(3), status: "completed" },
  { id: "t_2", kind: "debit", amount: walletMoney(5_000_000), description: "Withdrawal to GTBank ••••4821", createdAt: isoDateHoursAgo(30), status: "completed" },
  { id: "t_3", kind: "credit", amount: walletMoney(2_000_000), description: "Escrow pending · Order #ZM1043", createdAt: isoDateHoursAgo(50), status: "pending" },
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
    if (amount.currency !== wallet.available.currency) throw new ApiError(422, "Withdrawals must be in your wallet currency");
    if (amount.amountMinor > wallet.available.amountMinor) throw new ApiError(422, "Amount is more than your available balance");
    const account = payoutAccounts.find((a) => a.id === payoutAccountId);
    const key = `${payoutAccountId}:${amount.amountMinor}:${transactions.length}`;
    if (seenIdempotencyKeys.has(key)) return transactions[0];
    seenIdempotencyKeys.add(key);
    wallet = { ...wallet, available: walletMoney(wallet.available.amountMinor - amount.amountMinor) };
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
