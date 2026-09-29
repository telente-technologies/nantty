import type { PlatformRole } from "../../../constants/platformRoles.constant.js";
import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import type { PlatformStaffAccount, Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import { adminError, type NumberedPage, type NumberedPageRequest } from "../../../utils/adminHttp.util.js";
import type { NewStaffAccountInput, StaffAccountChanges, StaffAccountFilter, StaffAccountRecord, StaffAccountStatus } from "../models/platformStaff.model.js";
import type { StaffAccountsRepository } from "./staffAccounts.repository.js";

function convertStaffAccountRow(row: PlatformStaffAccount): StaffAccountRecord {
  return { ...row, role: row.role as PlatformRole, status: row.status as StaffAccountStatus };
}

function buildStaffAccountWhere(filter: StaffAccountFilter, now: Date): Prisma.PlatformStaffAccountWhereInput {
  const search = filter.search?.trim();
  const statusFilter: Prisma.PlatformStaffAccountWhereInput =
    filter.status === undefined
      ? {}
      : filter.status === "LOCKED"
        ? { status: "ACTIVE", lockedUntil: { gt: now } }
        : filter.status === "ACTIVE"
          ? { status: "ACTIVE", OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] }
          : { status: filter.status };
  return {
    ...statusFilter,
    ...(filter.role === undefined ? {} : { role: filter.role }),
    ...(search === undefined || search === ""
      ? {}
      : { AND: [{ OR: [{ email: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }] }] }),
  };
}

export class PrismaStaffAccountsRepository implements StaffAccountsRepository {
  public async findById(id: string): Promise<StaffAccountRecord | undefined> {
    const row = await prisma().platformStaffAccount.findUnique({ where: { id } });
    return row === null ? undefined : convertStaffAccountRow(row);
  }

  public async findByEmail(email: string): Promise<StaffAccountRecord | undefined> {
    const row = await prisma().platformStaffAccount.findUnique({ where: { email } });
    return row === null ? undefined : convertStaffAccountRow(row);
  }

  public async findManyByIds(ids: readonly string[]): Promise<readonly StaffAccountRecord[]> {
    const rows = await prisma().platformStaffAccount.findMany({ where: { id: { in: [...ids] } } });
    return rows.map(convertStaffAccountRow);
  }

  public async listAll(): Promise<readonly StaffAccountRecord[]> {
    const rows = await prisma().platformStaffAccount.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(convertStaffAccountRow);
  }

  public async list(filter: StaffAccountFilter, page: NumberedPageRequest, now: Date): Promise<NumberedPage<StaffAccountRecord>> {
    const where = buildStaffAccountWhere(filter, now);
    const [rows, total] = await Promise.all([
      prisma().platformStaffAccount.findMany({ where, orderBy: { createdAt: "asc" }, skip: (page.page - 1) * page.pageSize, take: page.pageSize }),
      prisma().platformStaffAccount.count({ where }),
    ]);
    return { items: rows.map(convertStaffAccountRow), page: page.page, pageSize: page.pageSize, total };
  }

  public async create(input: NewStaffAccountInput, now: Date): Promise<StaffAccountRecord> {
    try {
      const row = await prisma().platformStaffAccount.create({
        data: { ...input, permissions: [...input.permissions], ipAllowList: [...input.ipAllowList], createdAt: now },
      });
      return convertStaffAccountRow(row);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw adminError(409, "ADMIN_EXISTS", "An admin with this email already exists.");
      throw error;
    }
  }

  public async update(id: string, changes: StaffAccountChanges, now: Date): Promise<StaffAccountRecord | undefined> {
    const { permissions, ipAllowList, recoveryCodeHashes, ...rest } = changes;
    const result = await prisma().platformStaffAccount.updateMany({
      where: { id },
      data: {
        ...rest,
        ...(permissions === undefined ? {} : { permissions: [...permissions] }),
        ...(ipAllowList === undefined ? {} : { ipAllowList: [...ipAllowList] }),
        ...(recoveryCodeHashes === undefined ? {} : { recoveryCodeHashes: [...recoveryCodeHashes] }),
        updatedAt: now,
      },
    });
    return result.count === 0 ? undefined : this.findById(id);
  }
}
