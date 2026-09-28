import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import type { NewPayoutAccount, NewWithdrawal, PayoutAccountRecord, WithdrawalRecord, WithdrawalStatus } from "../models/wallets.model.js";

export interface PayoutAccountsRepository {
  listForStore(storeId: string): Promise<readonly PayoutAccountRecord[]>;
  findForStore(storeId: string, payoutAccountId: string): Promise<PayoutAccountRecord | undefined>;
  create(input: NewPayoutAccount): Promise<PayoutAccountRecord>;
  delete(storeId: string, payoutAccountId: string): Promise<boolean>;
  saveRecipientCode(payoutAccountId: string, recipientCode: string): Promise<void>;
}

export interface WithdrawalsRepository {
  create(input: NewWithdrawal): Promise<WithdrawalRecord>;
  findById(id: string): Promise<WithdrawalRecord | undefined>;
  listForStore(storeId: string, page: PageRequest): Promise<Page<WithdrawalRecord>>;
  changeStatus(id: string, from: WithdrawalStatus, to: WithdrawalStatus, processedAt: Date, failureReason: string | null): Promise<boolean>;
}

export class InMemoryPayoutAccountsRepository implements PayoutAccountsRepository {
  private readonly accounts = new Map<string, PayoutAccountRecord>();

  public async listForStore(storeId: string): Promise<readonly PayoutAccountRecord[]> {
    return [...this.accounts.values()].filter((account) => account.storeId === storeId);
  }

  public async findForStore(storeId: string, payoutAccountId: string): Promise<PayoutAccountRecord | undefined> {
    const account = this.accounts.get(payoutAccountId);
    return account?.storeId === storeId ? account : undefined;
  }

  public async create(input: NewPayoutAccount): Promise<PayoutAccountRecord> {
    const account: PayoutAccountRecord = { ...input, id: randomUUID(), recipientCode: null, createdAt: new Date() };
    this.accounts.set(account.id, account);
    return account;
  }

  public async delete(storeId: string, payoutAccountId: string): Promise<boolean> {
    if ((await this.findForStore(storeId, payoutAccountId)) === undefined) return false;
    return this.accounts.delete(payoutAccountId);
  }

  public async saveRecipientCode(payoutAccountId: string, recipientCode: string): Promise<void> {
    const account = this.accounts.get(payoutAccountId);
    if (account !== undefined) this.accounts.set(payoutAccountId, { ...account, recipientCode });
  }
}

export class InMemoryWithdrawalsRepository implements WithdrawalsRepository {
  private readonly withdrawals = new Map<string, WithdrawalRecord>();

  public async create(input: NewWithdrawal): Promise<WithdrawalRecord> {
    const withdrawal: WithdrawalRecord = { ...input, id: randomUUID(), status: "pending", failureReason: null, processedAt: null, createdAt: new Date() };
    this.withdrawals.set(withdrawal.id, withdrawal);
    return withdrawal;
  }

  public async findById(id: string): Promise<WithdrawalRecord | undefined> {
    return this.withdrawals.get(id);
  }

  public async listForStore(storeId: string, page: PageRequest): Promise<Page<WithdrawalRecord>> {
    const items = [...this.withdrawals.values()].filter((withdrawal) => withdrawal.storeId === storeId).sort(compareByNewestFirst);
    return paginateSortedItems(items, page);
  }

  public async changeStatus(id: string, from: WithdrawalStatus, to: WithdrawalStatus, processedAt: Date, failureReason: string | null): Promise<boolean> {
    const withdrawal = this.withdrawals.get(id);
    if (withdrawal === undefined || withdrawal.status !== from) return false;
    this.withdrawals.set(id, { ...withdrawal, status: to, processedAt, failureReason });
    return true;
  }
}
