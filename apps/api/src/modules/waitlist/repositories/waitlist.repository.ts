import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import type { NewWaitlistEntry, WaitlistEntryRecord } from "../models/waitlist.model.js";

export interface WaitlistRepository {
  addEntryIfEmailIsNew(entry: NewWaitlistEntry, createdAt: Date): Promise<boolean>;
  list(page: PageRequest): Promise<Page<WaitlistEntryRecord>>;
  countEntries(): Promise<number>;
}

export class InMemoryWaitlistRepository implements WaitlistRepository {
  private readonly entries = new Map<string, WaitlistEntryRecord>();

  public async addEntryIfEmailIsNew(entry: NewWaitlistEntry, createdAt: Date): Promise<boolean> {
    if (this.entries.has(entry.email)) return false;
    this.entries.set(entry.email, { ...entry, id: randomUUID(), createdAt });
    return true;
  }

  public async list(page: PageRequest): Promise<Page<WaitlistEntryRecord>> {
    return paginateSortedItems([...this.entries.values()].sort(compareByNewestFirst), page);
  }

  public async countEntries(): Promise<number> {
    return this.entries.size;
  }
}
