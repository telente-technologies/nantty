import { randomUUID } from "node:crypto";

import type { AuditEntry } from "../../../interfaces/audit.interface.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import type { AuditEventFilter, AuditEventRecord } from "../models/audit.model.js";

export interface AuditRepository {
  append(entry: AuditEntry, createdAt: Date): Promise<AuditEventRecord>;
  findById(id: string): Promise<AuditEventRecord | undefined>;
  list(filter: AuditEventFilter, page: PageRequest): Promise<Page<AuditEventRecord>>;
}

export class InMemoryAuditRepository implements AuditRepository {
  private readonly events: AuditEventRecord[] = [];

  public async append(entry: AuditEntry, createdAt: Date): Promise<AuditEventRecord> {
    const record: AuditEventRecord = { ...entry, id: randomUUID(), metadata: entry.metadata ?? {}, createdAt };
    this.events.push(record);
    return record;
  }

  public async findById(id: string): Promise<AuditEventRecord | undefined> {
    return this.events.find((event) => event.id === id);
  }

  public async list(filter: AuditEventFilter, page: PageRequest): Promise<Page<AuditEventRecord>> {
    const matches = this.events
      .filter((event) => (filter.entityType === undefined || event.entityType === filter.entityType)
        && (filter.entityId === undefined || event.entityId === filter.entityId)
        && (filter.actorId === undefined || event.actorId === filter.actorId)
        && (filter.action === undefined || event.action === filter.action))
      .sort(compareByNewestFirst);
    return paginateSortedItems(matches, page);
  }
}
