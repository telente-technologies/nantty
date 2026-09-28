import { randomUUID } from "node:crypto";

import { ConflictError } from "@zudojs/errors";

import type { StoreRole } from "../../../constants/roles.constant.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import type { NewStoreInput, StoreChanges, StoreFilter, StoreMemberRecord, StoreRecord, StoreStatus } from "../models/stores.model.js";

export interface StoresRepository {
  createWithOwner(input: NewStoreInput): Promise<StoreRecord>;
  findById(id: string): Promise<StoreRecord | undefined>;
  findBySlug(slug: string): Promise<StoreRecord | undefined>;
  findManyByIds(ids: readonly string[]): Promise<readonly StoreRecord[]>;
  list(filter: StoreFilter, page: PageRequest): Promise<Page<StoreRecord>>;
  searchByName(term: string, limit: number): Promise<readonly StoreRecord[]>;
  listSuspendedStoreIds(): Promise<readonly string[]>;
  countOwnedBy(ownerId: string): Promise<number>;
  update(id: string, changes: StoreChanges): Promise<StoreRecord | undefined>;
  updateStatus(id: string, status: StoreStatus): Promise<StoreRecord | undefined>;
  updateRating(id: string, ratingAverage: number, ratingCount: number): Promise<void>;
  listMembers(storeId: string): Promise<readonly StoreMemberRecord[]>;
  findMember(storeId: string, userId: string): Promise<StoreMemberRecord | undefined>;
  addMember(storeId: string, userId: string, role: StoreRole): Promise<StoreMemberRecord>;
  removeMember(storeId: string, userId: string): Promise<boolean>;
  listStoreIdsForMember(userId: string): Promise<readonly string[]>;
}

export class InMemoryStoresRepository implements StoresRepository {
  private readonly stores = new Map<string, StoreRecord>();
  private readonly members: StoreMemberRecord[] = [];

  public async createWithOwner(input: NewStoreInput): Promise<StoreRecord> {
    if ([...this.stores.values()].some((store) => store.slug === input.slug)) throw new ConflictError("This store link is taken.");
    const now = new Date();
    const store: StoreRecord = {
      ...input, id: randomUUID(), status: "active", featured: false, ratingAverage: 0, ratingCount: 0, createdAt: now, updatedAt: now,
    };
    this.stores.set(store.id, store);
    this.members.push({ storeId: store.id, userId: input.ownerId, role: "owner", createdAt: now });
    return store;
  }

  public async findById(id: string): Promise<StoreRecord | undefined> {
    return this.stores.get(id);
  }

  public async findBySlug(slug: string): Promise<StoreRecord | undefined> {
    return [...this.stores.values()].find((store) => store.slug === slug);
  }

  public async findManyByIds(ids: readonly string[]): Promise<readonly StoreRecord[]> {
    return ids.map((id) => this.stores.get(id)).filter((store): store is StoreRecord => store !== undefined);
  }

  public async list(filter: StoreFilter, page: PageRequest): Promise<Page<StoreRecord>> {
    const matches = [...this.stores.values()]
      .filter((store) => filter.includeSuspended === true || store.status === "active")
      .filter((store) => filter.featured === undefined || store.featured === filter.featured)
      .sort(compareByNewestFirst);
    return paginateSortedItems(matches, page);
  }

  public async searchByName(term: string, limit: number): Promise<readonly StoreRecord[]> {
    const needle = term.toLowerCase();
    return [...this.stores.values()]
      .filter((store) => store.status === "active" && (store.name.toLowerCase().includes(needle) || store.description.toLowerCase().includes(needle)))
      .sort(compareByNewestFirst)
      .slice(0, limit);
  }

  public async listSuspendedStoreIds(): Promise<readonly string[]> {
    return [...this.stores.values()].filter((store) => store.status === "suspended").map((store) => store.id);
  }

  public async countOwnedBy(ownerId: string): Promise<number> {
    return [...this.stores.values()].filter((store) => store.ownerId === ownerId).length;
  }

  public async update(id: string, changes: StoreChanges): Promise<StoreRecord | undefined> {
    return this.patch(id, { ...changes });
  }

  public async updateStatus(id: string, status: StoreStatus): Promise<StoreRecord | undefined> {
    return this.patch(id, { status });
  }

  public async updateRating(id: string, ratingAverage: number, ratingCount: number): Promise<void> {
    this.patch(id, { ratingAverage, ratingCount });
  }

  public async listMembers(storeId: string): Promise<readonly StoreMemberRecord[]> {
    return this.members.filter((member) => member.storeId === storeId);
  }

  public async findMember(storeId: string, userId: string): Promise<StoreMemberRecord | undefined> {
    return this.members.find((member) => member.storeId === storeId && member.userId === userId);
  }

  public async addMember(storeId: string, userId: string, role: StoreRole): Promise<StoreMemberRecord> {
    if (await this.findMember(storeId, userId)) throw new ConflictError("This person is already a member of the store.");
    const member: StoreMemberRecord = { storeId, userId, role, createdAt: new Date() };
    this.members.push(member);
    return member;
  }

  public async removeMember(storeId: string, userId: string): Promise<boolean> {
    const index = this.members.findIndex((member) => member.storeId === storeId && member.userId === userId);
    if (index === -1) return false;
    this.members.splice(index, 1);
    return true;
  }

  public async listStoreIdsForMember(userId: string): Promise<readonly string[]> {
    return this.members.filter((member) => member.userId === userId).map((member) => member.storeId);
  }

  private patch(id: string, changes: Partial<StoreRecord>): StoreRecord | undefined {
    const store = this.stores.get(id);
    if (store === undefined) return undefined;
    const updated: StoreRecord = { ...store, ...changes, updatedAt: new Date() };
    this.stores.set(id, updated);
    return updated;
  }
}
