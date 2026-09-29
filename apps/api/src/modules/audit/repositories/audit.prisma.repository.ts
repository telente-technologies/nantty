import type { AuditEvent, Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { AuditActorKind, AuditEntry } from "../../../interfaces/audit.interface.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import type { NumberedPage, NumberedPageRequest } from "../../../utils/adminHttp.util.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import { deriveAuditArea, type AuditEventFilter, type AuditEventRecord } from "../models/audit.model.js";
import type { AuditFacets, AuditRepository } from "./audit.repository.js";

function convertAuditRowToRecord(row: AuditEvent): AuditEventRecord {
  return {
    id: row.id,
    actorId: row.actorId,
    actorKind: row.actorKind as AuditActorKind,
    actorName: row.actorName,
    ...(row.actorRole === null ? {} : { actorRole: row.actorRole }),
    action: row.action,
    area: row.area,
    entityType: row.entityType,
    entityId: row.entityId,
    targetLabel: row.targetLabel,
    reason: row.reason,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    ...(row.before === null ? {} : { before: row.before }),
    ...(row.after === null ? {} : { after: row.after }),
    ...(row.ip === null ? {} : { ip: row.ip }),
    ...(row.requestId === null ? {} : { requestId: row.requestId }),
    stepUpVerified: row.stepUpVerified,
    createdAt: row.createdAt,
  };
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined || value === null ? undefined : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);
}

function buildAuditWhere(filter: AuditEventFilter): Prisma.AuditEventWhereInput {
  const search = filter.search?.trim();
  return {
    ...(filter.entityType === undefined ? {} : { entityType: filter.entityType }),
    ...(filter.entityId === undefined ? {} : { entityId: filter.entityId }),
    ...(filter.actorId === undefined ? {} : { actorId: filter.actorId }),
    ...(filter.action === undefined ? {} : { action: filter.action }),
    ...(filter.area === undefined ? {} : { area: filter.area }),
    ...(filter.from === undefined && filter.to === undefined ? {} : { createdAt: { ...(filter.from === undefined ? {} : { gte: filter.from }), ...(filter.to === undefined ? {} : { lte: filter.to }) } }),
    ...(search === undefined || search === ""
      ? {}
      : {
          OR: [
            { action: { contains: search, mode: "insensitive" } },
            { actorName: { contains: search, mode: "insensitive" } },
            { targetLabel: { contains: search, mode: "insensitive" } },
            { entityId: { contains: search, mode: "insensitive" } },
            { reason: { contains: search, mode: "insensitive" } },
          ],
        }),
  };
}

export class PrismaAuditRepository implements AuditRepository {
  public async append(entry: AuditEntry, createdAt: Date): Promise<AuditEventRecord> {
    const before = toJsonValue(entry.before);
    const after = toJsonValue(entry.after);
    const row = await prisma().auditEvent.create({
      data: {
        actorId: entry.actorId,
        actorKind: entry.actorKind ?? (entry.actorId === null ? "SYSTEM" : "USER"),
        actorName: entry.actorName ?? "",
        actorRole: entry.actorRole ?? null,
        action: entry.action,
        area: deriveAuditArea(entry),
        entityType: entry.entityType,
        entityId: entry.entityId,
        targetLabel: entry.targetLabel ?? "",
        reason: entry.reason ?? "",
        metadata: JSON.parse(JSON.stringify(entry.metadata ?? {})),
        ...(before === undefined ? {} : { before }),
        ...(after === undefined ? {} : { after }),
        ip: entry.ip ?? null,
        requestId: entry.requestId ?? null,
        stepUpVerified: entry.stepUpVerified ?? false,
        createdAt,
      },
    });
    return convertAuditRowToRecord(row);
  }

  public async findById(id: string): Promise<AuditEventRecord | undefined> {
    const row = await prisma().auditEvent.findUnique({ where: { id } });
    return row === null ? undefined : convertAuditRowToRecord(row);
  }

  public async list(filter: AuditEventFilter, page: PageRequest): Promise<Page<AuditEventRecord>> {
    const rows = await prisma().auditEvent.findMany({
      where: buildAuditWhere(filter),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertAuditRowToRecord);
  }

  public async listNumbered(filter: AuditEventFilter, page: NumberedPageRequest): Promise<NumberedPage<AuditEventRecord>> {
    const where = buildAuditWhere(filter);
    const [rows, total] = await Promise.all([
      prisma().auditEvent.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page.page - 1) * page.pageSize, take: page.pageSize }),
      prisma().auditEvent.count({ where }),
    ]);
    return { items: rows.map(convertAuditRowToRecord), page: page.page, pageSize: page.pageSize, total };
  }

  public async listForTargets(targets: readonly { readonly entityType: string; readonly entityId: string }[], limit: number): Promise<readonly AuditEventRecord[]> {
    if (targets.length === 0) return [];
    const rows = await prisma().auditEvent.findMany({
      where: { OR: targets.map((target) => ({ entityType: target.entityType, entityId: target.entityId })) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });
    return rows.map(convertAuditRowToRecord);
  }

  public async findFacets(): Promise<AuditFacets> {
    const [areas, actors] = await Promise.all([
      prisma().auditEvent.findMany({ distinct: ["area"], select: { area: true }, orderBy: { area: "asc" } }),
      prisma().auditEvent.findMany({ where: { actorKind: "ADMIN", actorId: { not: null } }, distinct: ["actorId"], select: { actorId: true, actorName: true }, take: 500 }),
    ]);
    return { areas: areas.map((row) => row.area), actors: actors.map((row) => ({ id: row.actorId as string, name: row.actorName })) };
  }
}
