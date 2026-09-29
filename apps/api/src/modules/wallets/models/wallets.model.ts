import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { MinorUnits } from "../../../types/money.type.js";

export const COIN_LEDGER_UNIT = "COIN";
export const LOYALTY_POINT_LEDGER_UNIT = "POINT";
export type LedgerUnit = CurrencyCode | typeof COIN_LEDGER_UNIT | typeof LOYALTY_POINT_LEDGER_UNIT;

export type LedgerAccountKind = "asset" | "liability" | "revenue";
export type LedgerDirection = "debit" | "credit";

export interface LedgerAccountSpecification {
  readonly key: string;
  readonly ownerType: string;
  readonly ownerId: string | null;
  readonly kind: LedgerAccountKind;
  readonly allowNegative: boolean;
}

export interface LedgerAccountRecord extends LedgerAccountSpecification {
  readonly id: string;
  readonly currency: LedgerUnit;
  readonly balance: MinorUnits;
  readonly version: number;
}

export interface LedgerLineInput {
  readonly account: LedgerAccountSpecification;
  readonly direction: LedgerDirection;
  readonly amount: MinorUnits;
  readonly currency: LedgerUnit;
}

export interface LedgerTransactionInput {
  readonly reference: string;
  readonly kind: string;
  readonly description: string;
  readonly lines: readonly LedgerLineInput[];
}

export interface LedgerEntryRecord {
  readonly id: string;
  readonly transactionId: string;
  readonly accountId: string;
  readonly direction: LedgerDirection;
  readonly amount: MinorUnits;
  readonly currency: LedgerUnit;
  readonly balanceAfter: MinorUnits;
  readonly createdAt: Date;
}

export interface LedgerTransactionRecord {
  readonly id: string;
  readonly reference: string;
  readonly kind: string;
  readonly description: string;
  readonly createdAt: Date;
  readonly entries: readonly LedgerEntryRecord[];
}

export interface LedgerPostingResult {
  readonly transaction: LedgerTransactionRecord;
  readonly created: boolean;
}

export type WithdrawalStatus = "pending" | "processing" | "paid" | "failed";

export type WalletOwner = { readonly kind: "store"; readonly storeId: string } | { readonly kind: "user"; readonly userId: string };

export type WalletScopeName = "store" | "user";

export interface WalletScopeInput {
  readonly scope: WalletScopeName;
  readonly storeId: string | undefined;
  readonly currency: CurrencyCode;
}

export function describeWalletOwner(owner: WalletOwner): { readonly storeId: string | null; readonly userId: string | null } {
  return owner.kind === "store" ? { storeId: owner.storeId, userId: null } : { storeId: null, userId: owner.userId };
}

export function findWalletOwnerOfRecord(record: { readonly storeId: string | null; readonly userId: string | null }): WalletOwner {
  if (record.storeId !== null) return { kind: "store", storeId: record.storeId };
  return { kind: "user", userId: record.userId ?? "" };
}

export interface PayoutAccountRecord {
  readonly id: string;
  readonly storeId: string | null;
  readonly userId: string | null;
  readonly bankCode: string;
  readonly bankName: string;
  readonly accountNumberEncrypted: string;
  readonly accountLast4: string;
  readonly accountName: string;
  readonly recipientCode: string | null;
  readonly isDefault: boolean;
  readonly createdAt: Date;
}

export type NewPayoutAccount = Omit<PayoutAccountRecord, "id" | "createdAt" | "recipientCode">;

export interface WithdrawalRecord {
  readonly id: string;
  readonly storeId: string | null;
  readonly userId: string | null;
  readonly payoutAccountId: string;
  readonly amount: MinorUnits;
  readonly fee: MinorUnits;
  readonly currency: CurrencyCode;
  readonly status: WithdrawalStatus;
  readonly reference: string;
  readonly requestedById: string;
  readonly failureReason: string | null;
  readonly processedAt: Date | null;
  readonly createdAt: Date;
}

export type NewWithdrawal = Omit<WithdrawalRecord, "id" | "createdAt" | "status" | "failureReason" | "processedAt">;

export function calculateBalanceChange(kind: LedgerAccountKind, direction: LedgerDirection, amount: MinorUnits): MinorUnits {
  const increasesOnDebit = kind === "asset";
  return (direction === "debit") === increasesOnDebit ? amount : -amount;
}

export type WalletTopUpStatus = "pending" | "succeeded" | "failed";

export interface WalletTopUpRecord {
  readonly id: string;
  readonly userId: string;
  readonly provider: string;
  readonly reference: string;
  readonly amount: MinorUnits;
  readonly currency: CurrencyCode;
  readonly status: WalletTopUpStatus;
  readonly authorizationUrl: string | null;
  readonly providerTransactionId: string | null;
  readonly creditedAt: Date | null;
  readonly createdAt: Date;
}

export type NewWalletTopUp = Pick<WalletTopUpRecord, "userId" | "provider" | "reference" | "amount" | "currency">;
