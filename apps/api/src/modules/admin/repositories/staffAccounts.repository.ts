import { randomUUID } from "node:crypto";

import { adminError, sliceNumberedPage, textMatchesSearch, type NumberedPage, type NumberedPageRequest } from "../../../utils/adminHttp.util.js";
import {
  presentStaffStatus,
  type NewStaffAccountInput,
  type StaffAccountChanges,
  type StaffAccountFilter,
  type StaffAccountRecord,
} from "../models/platformStaff.model.js";

export interface StaffAccountsRepository {
  findById(id: string): Promise<StaffAccountRecord | undefined>;
  findByEmail(email: string): Promise<StaffAccountRecord | undefined>;
  findManyByIds(ids: readonly string[]): Promise<readonly StaffAccountRecord[]>;
  listAll(): Promise<readonly StaffAccountRecord[]>;
  list(filter: StaffAccountFilter, page: NumberedPageRequest, now: Date): Promise<NumberedPage<StaffAccountRecord>>;
  create(input: NewStaffAccountInput, now: Date): Promise<StaffAccountRecord>;
  update(id: string, changes: StaffAccountChanges, now: Date): Promise<StaffAccountRecord | undefined>;
}

export function staffAccountMatchesFilter(account: StaffAccountRecord, filter: StaffAccountFilter, now: Date): boolean {
  if (filter.role !== undefined && account.role !== filter.role) return false;
  if (filter.status !== undefined && presentStaffStatus(account, now) !== filter.status) return false;
  return textMatchesSearch(filter.search, account.email, account.name);
}

export class InMemoryStaffAccountsRepository implements StaffAccountsRepository {
  private readonly accounts = new Map<string, StaffAccountRecord>();

  public async findById(id: string): Promise<StaffAccountRecord | undefined> {
    return this.accounts.get(id);
  }

  public async findByEmail(email: string): Promise<StaffAccountRecord | undefined> {
    return [...this.accounts.values()].find((account) => account.email === email);
  }

  public async findManyByIds(ids: readonly string[]): Promise<readonly StaffAccountRecord[]> {
    return ids.map((id) => this.accounts.get(id)).filter((account): account is StaffAccountRecord => account !== undefined);
  }

  public async listAll(): Promise<readonly StaffAccountRecord[]> {
    return [...this.accounts.values()].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  public async list(filter: StaffAccountFilter, page: NumberedPageRequest, now: Date): Promise<NumberedPage<StaffAccountRecord>> {
    const matches = (await this.listAll()).filter((account) => staffAccountMatchesFilter(account, filter, now));
    return sliceNumberedPage(matches, page);
  }

  public async create(input: NewStaffAccountInput, now: Date): Promise<StaffAccountRecord> {
    if (await this.findByEmail(input.email)) throw adminError(409, "ADMIN_EXISTS", "An admin with this email already exists.");
    const account: StaffAccountRecord = {
      ...input,
      id: randomUUID(),
      permissions: [...input.permissions],
      ipAllowList: [...input.ipAllowList],
      totpSecretEncrypted: null,
      pendingTotpSecretEncrypted: null,
      totpEnabledAt: null,
      totpLastUsedStep: null,
      recoveryCodeHashes: [],
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      disabledAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.set(account.id, account);
    return account;
  }

  public async update(id: string, changes: StaffAccountChanges, now: Date): Promise<StaffAccountRecord | undefined> {
    const account = this.accounts.get(id);
    if (account === undefined) return undefined;
    const updated: StaffAccountRecord = { ...account, ...changes, updatedAt: now };
    this.accounts.set(id, updated);
    return updated;
  }
}
