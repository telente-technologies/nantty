import { randomUUID } from "node:crypto";

import type { AdAccountChanges, AdAccountMemberRecord, AdAccountRecord, AdAccountRole, NewAdAccountInput } from "../models/adAccounts.model.js";

export interface AdAccountsRepository {
  createAccountWithOwner(input: NewAdAccountInput, now: Date): Promise<AdAccountRecord>;
  findAccountById(accountId: string): Promise<AdAccountRecord | undefined>;
  findAccountByStoreId(storeId: string): Promise<AdAccountRecord | undefined>;
  findPersonalAccountForOwner(ownerId: string): Promise<AdAccountRecord | undefined>;
  updateAccount(accountId: string, changes: AdAccountChanges, now: Date): Promise<AdAccountRecord>;
  findMember(accountId: string, userId: string): Promise<AdAccountMemberRecord | undefined>;
  listMembers(accountId: string): Promise<readonly AdAccountMemberRecord[]>;
  listMembershipsForUser(userId: string): Promise<readonly AdAccountMemberRecord[]>;
  findAccountsByIds(accountIds: readonly string[]): Promise<readonly AdAccountRecord[]>;
  addMember(accountId: string, userId: string, role: AdAccountRole, now: Date): Promise<AdAccountMemberRecord>;
  changeMemberRole(accountId: string, userId: string, role: AdAccountRole): Promise<AdAccountMemberRecord>;
  removeMember(accountId: string, userId: string): Promise<void>;
  touchMember(accountId: string, userId: string, now: Date): Promise<void>;
}

export class InMemoryAdAccountsRepository implements AdAccountsRepository {
  private readonly accounts = new Map<string, AdAccountRecord>();
  private readonly members = new Map<string, AdAccountMemberRecord>();

  public async createAccountWithOwner(input: NewAdAccountInput, now: Date): Promise<AdAccountRecord> {
    const account: AdAccountRecord = { ...input, id: randomUUID(), status: "active", disabledReason: null, monthlySpendLimitMinor: null, createdAt: now, updatedAt: now };
    this.accounts.set(account.id, account);
    await this.addMember(account.id, input.ownerId, "admin", now);
    return account;
  }

  public async findAccountById(accountId: string): Promise<AdAccountRecord | undefined> {
    return this.accounts.get(accountId);
  }

  public async findAccountByStoreId(storeId: string): Promise<AdAccountRecord | undefined> {
    return [...this.accounts.values()].find((account) => account.storeId === storeId);
  }

  public async findPersonalAccountForOwner(ownerId: string): Promise<AdAccountRecord | undefined> {
    return [...this.accounts.values()].find((account) => account.ownerId === ownerId && account.kind === "personal");
  }

  public async updateAccount(accountId: string, changes: AdAccountChanges, now: Date): Promise<AdAccountRecord> {
    const account = this.accounts.get(accountId);
    if (account === undefined) throw new Error(`Ad account ${accountId} does not exist.`);
    const updated = { ...account, ...changes, updatedAt: now };
    this.accounts.set(accountId, updated);
    return updated;
  }

  public async findMember(accountId: string, userId: string): Promise<AdAccountMemberRecord | undefined> {
    return this.members.get(`${accountId}:${userId}`);
  }

  public async listMembers(accountId: string): Promise<readonly AdAccountMemberRecord[]> {
    return [...this.members.values()].filter((member) => member.accountId === accountId).sort((left, right) => left.addedAt.getTime() - right.addedAt.getTime());
  }

  public async listMembershipsForUser(userId: string): Promise<readonly AdAccountMemberRecord[]> {
    return [...this.members.values()].filter((member) => member.userId === userId);
  }

  public async findAccountsByIds(accountIds: readonly string[]): Promise<readonly AdAccountRecord[]> {
    return accountIds.map((id) => this.accounts.get(id)).filter((account): account is AdAccountRecord => account !== undefined);
  }

  public async addMember(accountId: string, userId: string, role: AdAccountRole, now: Date): Promise<AdAccountMemberRecord> {
    const member = { accountId, userId, role, addedAt: now, lastActiveAt: null };
    this.members.set(`${accountId}:${userId}`, member);
    return member;
  }

  public async changeMemberRole(accountId: string, userId: string, role: AdAccountRole): Promise<AdAccountMemberRecord> {
    const member = this.members.get(`${accountId}:${userId}`);
    if (member === undefined) throw new Error("Member does not exist.");
    const updated = { ...member, role };
    this.members.set(`${accountId}:${userId}`, updated);
    return updated;
  }

  public async removeMember(accountId: string, userId: string): Promise<void> {
    this.members.delete(`${accountId}:${userId}`);
  }

  public async touchMember(accountId: string, userId: string, now: Date): Promise<void> {
    const member = this.members.get(`${accountId}:${userId}`);
    if (member !== undefined) this.members.set(`${accountId}:${userId}`, { ...member, lastActiveAt: now });
  }
}
