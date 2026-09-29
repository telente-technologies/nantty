import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import type { CreatorEarning, LiveGift } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { convertDatabaseAmountToMinorUnits } from "../../../utils/money.util.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type { EarningUnit, CreatorEarningKind, CreatorEarningRecord, CreatorEarningSource, LiveGiftRecord, NewCreatorEarning, NewLiveGift } from "../models/creators.model.js";
import type { CreatorEarningsRepository, EarningTotal } from "./creatorEarnings.repository.js";

function convertEarningRowToRecord(row: CreatorEarning): CreatorEarningRecord {
  return {
    ...row,
    kind: row.kind as CreatorEarningKind,
    sourceType: row.sourceType as CreatorEarningSource,
    grossAmount: convertDatabaseAmountToMinorUnits(row.grossAmount),
    netAmount: convertDatabaseAmountToMinorUnits(row.netAmount),
    currency: row.currency as EarningUnit,
  };
}

function convertGiftRowToRecord(row: LiveGift): LiveGiftRecord {
  return { ...row, amount: convertDatabaseAmountToMinorUnits(row.amount), currency: row.currency as EarningUnit };
}

export class PrismaCreatorEarningsRepository implements CreatorEarningsRepository {
  public async recordEarningIfNew(earning: NewCreatorEarning): Promise<boolean> {
    try {
      await prisma().creatorEarning.create({ data: { ...earning, grossAmount: BigInt(earning.grossAmount), netAmount: BigInt(earning.netAmount) } });
      return true;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  public async listEarnings(creatorId: string, page: PageRequest): Promise<Page<CreatorEarningRecord>> {
    const rows = await prisma().creatorEarning.findMany({
      where: { creatorId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertEarningRowToRecord);
  }

  public async sumEarningsSince(creatorId: string, since: Date | null): Promise<readonly EarningTotal[]> {
    const groups = await prisma().creatorEarning.groupBy({
      by: ["kind", "currency"],
      where: { creatorId, ...(since === null ? {} : { createdAt: { gte: since } }) },
      _sum: { netAmount: true },
      _count: { _all: true },
    });
    return groups.map((group) => ({
      kind: group.kind as CreatorEarningKind,
      currency: group.currency as EarningUnit,
      netAmount: convertDatabaseAmountToMinorUnits(group._sum.netAmount ?? 0n),
      count: group._count._all,
    }));
  }

  public async recordLiveGiftIfNew(gift: NewLiveGift): Promise<{ readonly gift: LiveGiftRecord; readonly created: boolean }> {
    try {
      const row = await prisma().liveGift.create({ data: { ...gift, amount: BigInt(gift.amount) } });
      return { gift: convertGiftRowToRecord(row), created: true };
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      const existing = await prisma().liveGift.findUniqueOrThrow({ where: { reference: gift.reference } });
      return { gift: convertGiftRowToRecord(existing), created: false };
    }
  }
}
