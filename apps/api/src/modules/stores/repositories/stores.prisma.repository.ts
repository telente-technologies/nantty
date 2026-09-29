import { randomUUID } from "node:crypto";

import { ConflictError } from "@zudojs/errors";

import type { StoreRole } from "../../../constants/roles.constant.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import type { Store, StoreMember } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { convertDatabaseAmountToMinorUnits } from "../../../utils/money.util.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type { NewStoreInput, StoreChanges, StoreFilter, StoreMemberRecord, StoreRecord, StoreStatus } from "../models/stores.model.js";
import type { StoresRepository } from "./stores.repository.js";

function convertStoreRowToRecord(row: Store): StoreRecord {
  const { ratingAvg, ratingCount, shippingFee, status, currency, ...rest } = row;
  return {
    ...rest,
    status: status === "suspended" ? "suspended" : "active",
    currency: currency as CurrencyCode,
    shippingFee: convertDatabaseAmountToMinorUnits(shippingFee),
    ratingAverage: ratingAvg,
    ratingCount,
  };
}

function convertMemberRowToRecord(row: StoreMember): StoreMemberRecord {
  return { ...row, role: row.role as StoreRole };
}

const newestFirst = [{ createdAt: "desc" as const }, { id: "desc" as const }];

export class PrismaStoresRepository implements StoresRepository {
  public async createWithOwner(input: NewStoreInput): Promise<StoreRecord> {
    const id = randomUUID();
    try {
      const [row] = await prisma().$transaction([
        prisma().store.create({ data: { ...input, id } }),
        prisma().storeMember.create({ data: { storeId: id, userId: input.ownerId, role: "owner" } }),
      ]);
      return convertStoreRowToRecord(row);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw new ConflictError("This store link is taken.");
      throw error;
    }
  }

  public async findById(id: string): Promise<StoreRecord | undefined> {
    const row = await prisma().store.findUnique({ where: { id } });
    return row === null ? undefined : convertStoreRowToRecord(row);
  }

  public async findBySlug(slug: string): Promise<StoreRecord | undefined> {
    const row = await prisma().store.findUnique({ where: { slug } });
    return row === null ? undefined : convertStoreRowToRecord(row);
  }

  public async findManyByIds(ids: readonly string[]): Promise<readonly StoreRecord[]> {
    return (await prisma().store.findMany({ where: { id: { in: [...ids] } } })).map(convertStoreRowToRecord);
  }

  public async list(filter: StoreFilter, page: PageRequest): Promise<Page<StoreRecord>> {
    const rows = await prisma().store.findMany({
      where: {
        ...(filter.includeSuspended === true ? {} : { status: "active" }),
        ...(filter.featured === undefined ? {} : { featured: filter.featured }),
      },
      orderBy: newestFirst,
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertStoreRowToRecord);
  }

  public async searchByName(term: string, limit: number): Promise<readonly StoreRecord[]> {
    const rows = await prisma().store.findMany({
      where: {
        status: "active",
        OR: [{ name: { contains: term, mode: "insensitive" } }, { description: { contains: term, mode: "insensitive" } }],
      },
      orderBy: newestFirst,
      take: limit,
    });
    return rows.map(convertStoreRowToRecord);
  }

  public async listSuspendedStoreIds(): Promise<readonly string[]> {
    return (await prisma().store.findMany({ where: { status: "suspended" }, select: { id: true } })).map((row) => row.id);
  }

  public countOwnedBy(ownerId: string): Promise<number> {
    return prisma().store.count({ where: { ownerId } });
  }

  public async update(id: string, changes: StoreChanges): Promise<StoreRecord | undefined> {
    const result = await prisma().store.updateMany({ where: { id }, data: { ...changes } });
    return result.count === 0 ? undefined : this.findById(id);
  }

  public async updateStatus(id: string, status: StoreStatus): Promise<StoreRecord | undefined> {
    const result = await prisma().store.updateMany({ where: { id }, data: { status } });
    return result.count === 0 ? undefined : this.findById(id);
  }

  public async updateRating(id: string, ratingAverage: number, ratingCount: number): Promise<void> {
    await prisma().store.updateMany({ where: { id }, data: { ratingAvg: ratingAverage, ratingCount } });
  }

  public async listMembers(storeId: string): Promise<readonly StoreMemberRecord[]> {
    return (await prisma().storeMember.findMany({ where: { storeId }, orderBy: { createdAt: "asc" } })).map(convertMemberRowToRecord);
  }

  public async findMember(storeId: string, userId: string): Promise<StoreMemberRecord | undefined> {
    const row = await prisma().storeMember.findUnique({ where: { storeId_userId: { storeId, userId } } });
    return row === null ? undefined : convertMemberRowToRecord(row);
  }

  public async addMember(storeId: string, userId: string, role: StoreRole): Promise<StoreMemberRecord> {
    try {
      return convertMemberRowToRecord(await prisma().storeMember.create({ data: { storeId, userId, role } }));
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw new ConflictError("This person is already a member of the store.");
      throw error;
    }
  }

  public async removeMember(storeId: string, userId: string): Promise<boolean> {
    return (await prisma().storeMember.deleteMany({ where: { storeId, userId } })).count > 0;
  }

  public async listStoreIdsForMember(userId: string): Promise<readonly string[]> {
    return (await prisma().storeMember.findMany({ where: { userId }, select: { storeId: true }, orderBy: { createdAt: "asc" } })).map((row) => row.storeId);
  }
}
