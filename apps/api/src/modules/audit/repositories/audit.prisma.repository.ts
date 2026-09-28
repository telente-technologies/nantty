import type { AuditEvent } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { AuditEntry } from "../../../interfaces/audit.interface.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type { AuditEventFilter, AuditEventRecord } from "../models/audit.model.js";
import type { AuditRepository } from "./audit.repository.js";

function convertAuditRowToRecord(row: AuditEvent): AuditEventRecord {
  return {
    id: row.id,
    actorId: row.actorId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    ...(row.ip === null ? {} : { ip: row.ip }),
    createdAt: row.createdAt,
  };
}

export class PrismaAuditRepository implements AuditRepository {
  public async append(entry: AuditEntry, createdAt: Date): Promise<AuditEventRecord> {
    const row = await prisma().auditEvent.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: JSON.parse(JSON.stringify(entry.metadata ?? {})),
        ip: entry.ip ?? null,
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
      where: { ...filter },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertAuditRowToRecord);
  }
}
