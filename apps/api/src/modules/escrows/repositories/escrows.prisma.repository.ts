import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { EscrowStatus } from "../../../enums/escrowStatus.enum.js";
import type { Dispute, Escrow } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { MinorUnits } from "../../../types/money.type.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { convertDatabaseAmountToMinorUnits } from "../../../utils/money.util.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type { DisputeRecord, DisputeStatus, EscrowRecord, EscrowStatusChange, NewDispute, NewEscrow } from "../models/escrows.model.js";
import type { DisputesRepository, EscrowsRepository } from "./escrows.repository.js";

function convertEscrowRowToRecord(row: Escrow): EscrowRecord {
  return { ...row, amount: convertDatabaseAmountToMinorUnits(row.amount), currency: row.currency as CurrencyCode, status: row.status as EscrowStatus };
}

function convertDisputeRowToRecord(row: Dispute): DisputeRecord {
  return { ...row, status: row.status as DisputeStatus };
}

export class PrismaEscrowsRepository implements EscrowsRepository {
  public async createHeldEscrow(input: NewEscrow) {
    try {
      const row = await prisma().escrow.create({ data: { ...input, amount: BigInt(input.amount), status: "held" } });
      return { escrow: convertEscrowRowToRecord(row), created: true };
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      const existing = await this.findByOrderId(input.orderId);
      if (existing === undefined) throw error;
      return { escrow: existing, created: false };
    }
  }

  public async findById(escrowId: string): Promise<EscrowRecord | undefined> {
    const row = await prisma().escrow.findUnique({ where: { id: escrowId } });
    return row === null ? undefined : convertEscrowRowToRecord(row);
  }

  public async findByOrderId(orderId: string): Promise<EscrowRecord | undefined> {
    const row = await prisma().escrow.findUnique({ where: { orderId } });
    return row === null ? undefined : convertEscrowRowToRecord(row);
  }

  public async transitionStatus(escrowId: string, from: readonly EscrowStatus[], to: EscrowStatus, change: EscrowStatusChange): Promise<EscrowRecord | undefined> {
    const result = await prisma().escrow.updateMany({
      where: { id: escrowId, status: { in: [...from] } },
      data: { ...change, status: to, version: { increment: 1 } },
    });
    return result.count === 1 ? this.findById(escrowId) : undefined;
  }

  public async scheduleRelease(orderId: string, releaseAfter: Date): Promise<void> {
    await prisma().escrow.updateMany({ where: { orderId, status: "held" }, data: { releaseAfter } });
  }

  public async listDueForRelease(now: Date, limit: number): Promise<readonly EscrowRecord[]> {
    const rows = await prisma().escrow.findMany({ where: { status: "held", releaseAfter: { lte: now } }, orderBy: { releaseAfter: "asc" }, take: limit });
    return rows.map(convertEscrowRowToRecord);
  }

  public async sumOutstandingForStore(storeId: string): Promise<MinorUnits> {
    const result = await prisma().escrow.aggregate({ where: { storeId, status: { in: ["held", "disputed"] } }, _sum: { amount: true } });
    return convertDatabaseAmountToMinorUnits(result._sum.amount ?? 0n);
  }
}

export class PrismaDisputesRepository implements DisputesRepository {
  public async create(input: NewDispute): Promise<DisputeRecord> {
    return convertDisputeRowToRecord(await prisma().dispute.create({ data: { ...input, evidenceMediaIds: [...input.evidenceMediaIds] } }));
  }

  public async findById(disputeId: string): Promise<DisputeRecord | undefined> {
    const row = await prisma().dispute.findUnique({ where: { id: disputeId } });
    return row === null ? undefined : convertDisputeRowToRecord(row);
  }

  public async findOpenForEscrow(escrowId: string): Promise<DisputeRecord | undefined> {
    const row = await prisma().dispute.findFirst({ where: { escrowId, status: "open" } });
    return row === null ? undefined : convertDisputeRowToRecord(row);
  }

  public async listForEscrow(escrowId: string): Promise<readonly DisputeRecord[]> {
    const rows = await prisma().dispute.findMany({ where: { escrowId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return rows.map(convertDisputeRowToRecord);
  }

  public async list(status: DisputeStatus | undefined, page: PageRequest): Promise<Page<DisputeRecord>> {
    const rows = await prisma().dispute.findMany({
      where: status === undefined ? {} : { status },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertDisputeRowToRecord);
  }

  public async resolve(disputeId: string, status: DisputeStatus, resolution: string, resolvedById: string, resolvedAt: Date): Promise<DisputeRecord | undefined> {
    const result = await prisma().dispute.updateMany({ where: { id: disputeId, status: "open" }, data: { status, resolution, resolvedById, resolvedAt } });
    return result.count === 1 ? this.findById(disputeId) : undefined;
  }
}
