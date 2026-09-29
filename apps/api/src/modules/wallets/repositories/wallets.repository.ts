import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import {
  describeWalletOwner,
  type NewPayoutAccount,
  type NewWithdrawal,
  type PayoutAccountRecord,
  type WalletOwner,
  type WithdrawalRecord,
  type WithdrawalStatus,
} from "../models/wallets.model.js";

export interface PayoutAccountsRepository {
  listForOwner(owner: WalletOwner): Promise<readonly PayoutAccountRecord[]>;
  findForOwner(owner: WalletOwner, payoutAccountId: string): Promise<PayoutAccountRecord | undefined>;
  create(input: NewPayoutAccount): Promise<PayoutAccountRecord>;
  delete(owner: WalletOwner, payoutAccountId: string): Promise<boolean>;
  saveRecipientCode(payoutAccountId: string, recipientCode: string): Promise<void>;
}

export interface WithdrawalsRepository {
  create(input: NewWithdrawal): Promise<WithdrawalRecord>;
  findById(id: string): Promise<WithdrawalRecord | undefined>;
  listForOwner(owner: WalletOwner, page: PageRequest): Promise<Page<WithdrawalRecord>>;
  changeStatus(id: string, from: WithdrawalStatus, to: WithdrawalStatus, processedAt: Date, failureReason: string | null): Promise<boolean>;
}

export function isOwnedBy(record: { readonly storeId: string | null; readonly userId: string | null }, owner: WalletOwner): boolean {
  const expected = describeWalletOwner(owner);
  return record.storeId === expected.storeId && record.userId === expected.userId;
}

export class InMemoryPayoutAccountsRepository implements PayoutAccountsRepository {
  private readonly accounts = new Map<string, PayoutAccountRecord>();

  public async listForOwner(owner: WalletOwner): Promise<readonly PayoutAccountRecord[]> {
    return [...this.accounts.values()].filter((account) => isOwnedBy(account, owner));
  }

  public async findForOwner(owner: WalletOwner, payoutAccountId: string): Promise<PayoutAccountRecord | undefined> {
    const account = this.accounts.get(payoutAccountId);
    return account !== undefined && isOwnedBy(account, owner) ? account : undefined;
  }

  public async create(input: NewPayoutAccount): Promise<PayoutAccountRecord> {
    const account: PayoutAccountRecord = { ...input, id: randomUUID(), recipientCode: null, createdAt: new Date() };
    this.accounts.set(account.id, account);
    return account;
  }

  public async delete(owner: WalletOwner, payoutAccountId: string): Promise<boolean> {
    if ((await this.findForOwner(owner, payoutAccountId)) === undefined) return false;
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

  public async listForOwner(owner: WalletOwner, page: PageRequest): Promise<Page<WithdrawalRecord>> {
    const items = [...this.withdrawals.values()].filter((withdrawal) => isOwnedBy(withdrawal, owner)).sort(compareByNewestFirst);
    return paginateSortedItems(items, page);
  }

  public async changeStatus(id: string, from: WithdrawalStatus, to: WithdrawalStatus, processedAt: Date, failureReason: string | null): Promise<boolean> {
    const withdrawal = this.withdrawals.get(id);
    if (withdrawal === undefined || withdrawal.status !== from) return false;
    this.withdrawals.set(id, { ...withdrawal, status: to, processedAt, failureReason });
    return true;
  }
}
