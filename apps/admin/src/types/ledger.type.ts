import type { Money, PagedList } from "@/types/api.type";

export type LedgerAccountKind = "asset" | "liability" | "equity" | "revenue" | "expense";

export interface LedgerAccount {
  readonly code: string;
  readonly name: string;
  readonly kind: LedgerAccountKind;
  readonly currency: string;
  readonly balance: Money;
  readonly ownerType: string | null;
  readonly ownerId: string | null;
  readonly entryCount: number;
}

export interface JournalLeg {
  readonly accountCode: string;
  readonly accountName: string;
  readonly direction: "debit" | "credit";
  readonly amount: Money;
}

export interface JournalEntry {
  readonly id: string;
  readonly reference: string;
  readonly externalReference: string | null;
  readonly kind: string;
  readonly description: string;
  readonly reversesEntryId: string | null;
  readonly postedAt: string;
  readonly legs: readonly JournalLeg[];
  readonly totalDebits: Money;
  readonly totalCredits: Money;
  readonly isBalanced: boolean;
}

export type JournalEntryList = PagedList<JournalEntry>;
