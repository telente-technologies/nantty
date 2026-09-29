import type { Money, PagedList } from "@/types/api.type";

export type LedgerAccountKind = "ASSET" | "LIABILITY" | "REVENUE" | "EXPENSE";

export interface LedgerAccount {
  readonly id: string;
  readonly name: string;
  readonly kind: LedgerAccountKind;
  readonly currency: string;
  readonly balance: Money;
  readonly ownerUserId: string | null;
  readonly entryCount: number;
}

export interface JournalLeg {
  readonly accountId: string;
  readonly accountName: string;
  readonly direction: "DEBIT" | "CREDIT";
  readonly amount: Money;
}

export interface JournalEntry {
  readonly id: string;
  readonly occurredAt: string;
  readonly description: string;
  readonly currency: string;
  readonly reference: { readonly type: "ORDER" | "PAYOUT" | "DISPUTE" | "REFUND" | "COIN"; readonly id: string; readonly label: string };
  readonly legs: readonly JournalLeg[];
  readonly totalDebits: Money;
  readonly totalCredits: Money;
  readonly isBalanced: boolean;
}

export type JournalEntryList = PagedList<JournalEntry>;
