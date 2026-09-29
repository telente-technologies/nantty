import { Money } from "../../../utils/money.util.js";
import type { LedgerEntryRecord, PayoutAccountRecord, WithdrawalRecord } from "../models/wallets.model.js";

export function convertPayoutAccountToDto(account: PayoutAccountRecord) {
  return {
    id: account.id,
    bankCode: account.bankCode,
    bankName: account.bankName,
    accountNumber: `******${account.accountLast4}`,
    accountName: account.accountName,
    isDefault: account.isDefault,
    createdAt: account.createdAt.toISOString(),
  };
}

export function convertWithdrawalToDto(withdrawal: WithdrawalRecord) {
  return {
    id: withdrawal.id,
    storeId: withdrawal.storeId,
    payoutAccountId: withdrawal.payoutAccountId,
    amount: Money.of(withdrawal.amount, withdrawal.currency).toDto(),
    status: withdrawal.status,
    reference: withdrawal.reference,
    failureReason: withdrawal.failureReason,
    processedAt: withdrawal.processedAt === null ? null : withdrawal.processedAt.toISOString(),
    createdAt: withdrawal.createdAt.toISOString(),
  };
}

export function convertLedgerEntryToDto(entry: LedgerEntryRecord) {
  return {
    id: entry.id,
    type: entry.direction === "credit" ? "credit" : "debit",
    amount: Money.of(entry.amount, entry.currency).toDto(),
    balanceAfter: Money.of(entry.balanceAfter, entry.currency).toDto(),
    createdAt: entry.createdAt.toISOString(),
  };
}
