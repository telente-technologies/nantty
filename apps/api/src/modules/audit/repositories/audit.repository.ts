import { randomUUID } from "node:crypto";

import type { AuditEntry } from "../../../interfaces/audit.interface.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { sliceNumberedPage, textMatchesSearch, type NumberedPage, type NumberedPageRequest } from "../../../utils/adminHttp.util.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import { deriveAuditArea, type AuditEventFilter, type AuditEventRecord } from "../models/audit.model.js";

export interface AuditFacets {
  readonly areas: readonly string[];
  readonly actors: readonly { readonly id: string; readonly name: string }[];
}

export interface AuditRepository {
  append(entry: AuditEntry, createdAt: Date): Promise<AuditEventRecord>;
  findById(id: string): Promise<AuditEventRecord | undefined>;
  list(filter: AuditEventFilter, page: PageRequest): Promise<Page<AuditEventRecord>>;
  listNumbered(filter: AuditEventFilter, page: NumberedPageRequest): Promise<NumberedPage<AuditEventRecord>>;
  listForTargets(targets: readonly { readonly entityType: string; readonly entityId: string }[], limit: number): Promise<readonly AuditEventRecord[]>;
  findFacets(): Promise<AuditFacets>;
}

export function convertAuditEntryToRecord(entry: AuditEntry, id: string, createdAt: Date): AuditEventRecord {
  return {
    ...entry,
    id,
    metadata: entry.metadata ?? {},
    actorKind: entry.actorKind ?? (entry.actorId === null ? "SYSTEM" : "USER"),
    actorName: entry.actorName ?? "",
    area: deriveAuditArea(entry),
    targetLabel: entry.targetLabel ?? "",
    reason: entry.reason ?? "",
    stepUpVerified: entry.stepUpVerified ?? false,
    createdAt,
  };
}

export function auditEventMatchesFilter(event: AuditEventRecord, filter: AuditEventFilter): boolean {
  if (filter.entityType !== undefined && event.entityType !== filter.entityType) return false;
  if (filter.entityId !== undefined && event.entityId !== filter.entityId) return false;
  if (filter.actorId !== undefined && event.actorId !== filter.actorId) return false;
  if (filter.action !== undefined && event.action !== filter.action) return false;
  if (filter.area !== undefined && event.area !== filter.area) return false;
  if (filter.from !== undefined && event.createdAt < filter.from) return false;
  if (filter.to !== undefined && event.createdAt > filter.to) return false;
  return textMatchesSearch(filter.search, event.action, event.actorName, event.targetLabel, event.entityId, event.reason);
}

export class InMemoryAuditRepository implements AuditRepository {
  private readonly events: AuditEventRecord[] = [];

  public async append(entry: AuditEntry, createdAt: Date): Promise<AuditEventRecord> {
    const record = convertAuditEntryToRecord(entry, randomUUID(), createdAt);
    this.events.push(record);
    return record;
  }

  public async findById(id: string): Promise<AuditEventRecord | undefined> {
    return this.events.find((event) => event.id === id);
  }

  public async list(filter: AuditEventFilter, page: PageRequest): Promise<Page<AuditEventRecord>> {
    return paginateSortedItems(this.events.filter((event) => auditEventMatchesFilter(event, filter)).sort(compareByNewestFirst), page);
  }

  public async listNumbered(filter: AuditEventFilter, page: NumberedPageRequest): Promise<NumberedPage<AuditEventRecord>> {
    return sliceNumberedPage(this.events.filter((event) => auditEventMatchesFilter(event, filter)).sort(compareByNewestFirst), page);
  }

  public async listForTargets(targets: readonly { readonly entityType: string; readonly entityId: string }[], limit: number): Promise<readonly AuditEventRecord[]> {
    return this.events
      .filter((event) => targets.some((target) => target.entityType === event.entityType && target.entityId === event.entityId))
      .sort(compareByNewestFirst)
      .slice(0, limit);
  }

  public async findFacets(): Promise<AuditFacets> {
    const areas = [...new Set(this.events.map((event) => event.area))].sort();
    const actors = new Map<string, string>();
    for (const event of this.events) if (event.actorId !== null && event.actorKind === "ADMIN") actors.set(event.actorId, event.actorName);
    return { areas, actors: [...actors.entries()].map(([id, name]) => ({ id, name })) };
  }
}
