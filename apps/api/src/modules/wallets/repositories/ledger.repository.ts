import { randomUUID } from "node:crypto";

import { insufficientFunds } from "../../../errors/domain.error.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import {
  calculateBalanceChange,
  type LedgerAccountRecord,
  type LedgerAccountSpecification,
  type LedgerEntryRecord,
  type LedgerPostingResult,
  type LedgerTransactionInput,
  type LedgerTransactionRecord,
} from "../models/wallets.model.js";

export interface LedgerRepository {
  postBalancedTransaction(input: LedgerTransactionInput, postedAt: Date): Promise<LedgerPostingResult>;
  findAccountByKey(key: string): Promise<LedgerAccountRecord | undefined>;
  findTransactionByReference(reference: string): Promise<LedgerTransactionRecord | undefined>;
  listEntriesForAccount(accountKey: string, page: PageRequest): Promise<Page<LedgerEntryRecord>>;
}

export class InMemoryLedgerRepository implements LedgerRepository {
  private readonly accounts = new Map<string, LedgerAccountRecord>();
  private readonly transactions = new Map<string, LedgerTransactionRecord>();
  private queue: Promise<unknown> = Promise.resolve();

  public postBalancedTransaction(input: LedgerTransactionInput, postedAt: Date): Promise<LedgerPostingResult> {
    const run = this.queue.then(() => this.applyTransactionAtomically(input, postedAt));
    this.queue = run.catch(() => undefined);
    return run;
  }

  public async findAccountByKey(key: string): Promise<LedgerAccountRecord | undefined> {
    return this.accounts.get(key);
  }

  public async findTransactionByReference(reference: string): Promise<LedgerTransactionRecord | undefined> {
    return this.transactions.get(reference);
  }

  public async listEntriesForAccount(accountKey: string, page: PageRequest): Promise<Page<LedgerEntryRecord>> {
    const account = this.accounts.get(accountKey);
    if (account === undefined) return { items: [], nextCursor: null };
    const entries = [...this.transactions.values()]
      .flatMap((transaction) => transaction.entries)
      .filter((entry) => entry.accountId === account.id)
      .sort(compareByNewestFirst);
    return paginateSortedItems(entries, page);
  }

  public listAllAccounts(): readonly LedgerAccountRecord[] {
    return [...this.accounts.values()];
  }

  public listAllTransactions(): readonly LedgerTransactionRecord[] {
    return [...this.transactions.values()];
  }

  private applyTransactionAtomically(input: LedgerTransactionInput, postedAt: Date): LedgerPostingResult {
    const existing = this.transactions.get(input.reference);
    if (existing !== undefined) return { transaction: existing, created: false };
    const workingAccounts = new Map<string, LedgerAccountRecord>();
    const transactionId = randomUUID();
    const entries: LedgerEntryRecord[] = input.lines.map((line) => {
      const account = workingAccounts.get(line.account.key) ?? this.findOrOpenAccount(line.account, input.currency);
      const balance = account.balance + calculateBalanceChange(account.kind, line.direction, line.amount);
      if (balance < 0 && !account.allowNegative) throw insufficientFunds();
      workingAccounts.set(account.key, { ...account, balance, version: account.version + 1 });
      return { id: randomUUID(), transactionId, accountId: account.id, direction: line.direction, amount: line.amount, balanceAfter: balance, createdAt: postedAt };
    });
    for (const account of workingAccounts.values()) this.accounts.set(account.key, account);
    const transaction: LedgerTransactionRecord = {
      id: transactionId,
      reference: input.reference,
      kind: input.kind,
      description: input.description,
      createdAt: postedAt,
      entries,
    };
    this.transactions.set(input.reference, transaction);
    return { transaction, created: true };
  }

  private findOrOpenAccount(specification: LedgerAccountSpecification, currency: string): LedgerAccountRecord {
    return this.accounts.get(specification.key) ?? { ...specification, id: randomUUID(), currency, balance: 0, version: 0 };
  }
}
