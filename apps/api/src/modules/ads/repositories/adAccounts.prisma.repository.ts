import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { prisma } from "../../../integrations/database.integration.js";
import { convertDatabaseAmountToMinorUnits } from "../../../utils/money.util.js";
import type { AdAccountChanges, AdAccountKind, AdAccountMemberRecord, AdAccountRecord, AdAccountRole, AdAccountStatus, NewAdAccountInput } from "../models/adAccounts.model.js";
import type { AdAccountsRepository } from "./adAccounts.repository.js";

type AccountRow = Awaited<ReturnType<ReturnType<typeof prisma>["adAccount"]["create"]>>;
type MemberRow = Awaited<ReturnType<ReturnType<typeof prisma>["adAccountMember"]["create"]>>;

function toAccount(row: AccountRow): AdAccountRecord {
  return {
    ...row,
    kind: row.kind as AdAccountKind,
    currency: row.currency as CurrencyCode,
    status: row.status as AdAccountStatus,
    monthlySpendLimitMinor: row.monthlySpendLimitMinor === null ? null : convertDatabaseAmountToMinorUnits(row.monthlySpendLimitMinor),
  };
}

function toMember(row: MemberRow): AdAccountMemberRecord {
  return { ...row, role: row.role as AdAccountRole };
}

export class PrismaAdAccountsRepository implements AdAccountsRepository {
  public async createAccountWithOwner(input: NewAdAccountInput, now: Date): Promise<AdAccountRecord> {
    const row = await prisma().$transaction(async (transaction) => {
      const account = await transaction.adAccount.create({ data: { ...input, createdAt: now, updatedAt: now } });
      await transaction.adAccountMember.create({ data: { accountId: account.id, userId: input.ownerId, role: "admin", addedAt: now } });
      return account;
    });
    return toAccount(row);
  }

  public async findAccountById(accountId: string): Promise<AdAccountRecord | undefined> {
    const row = await prisma().adAccount.findUnique({ where: { id: accountId } });
    return row === null ? undefined : toAccount(row);
  }

  public async findAccountByStoreId(storeId: string): Promise<AdAccountRecord | undefined> {
    const row = await prisma().adAccount.findUnique({ where: { storeId } });
    return row === null ? undefined : toAccount(row);
  }

  public async findPersonalAccountForOwner(ownerId: string): Promise<AdAccountRecord | undefined> {
    const row = await prisma().adAccount.findFirst({ where: { ownerId, kind: "personal" }, orderBy: { createdAt: "asc" } });
    return row === null ? undefined : toAccount(row);
  }

  public async updateAccount(accountId: string, changes: AdAccountChanges, now: Date): Promise<AdAccountRecord> {
    const { monthlySpendLimitMinor, ...rest } = changes;
    const row = await prisma().adAccount.update({
      where: { id: accountId },
      data: { ...rest, ...(monthlySpendLimitMinor === undefined ? {} : { monthlySpendLimitMinor: monthlySpendLimitMinor === null ? null : BigInt(monthlySpendLimitMinor) }), updatedAt: now },
    });
    return toAccount(row);
  }

  public async findMember(accountId: string, userId: string): Promise<AdAccountMemberRecord | undefined> {
    const row = await prisma().adAccountMember.findUnique({ where: { accountId_userId: { accountId, userId } } });
    return row === null ? undefined : toMember(row);
  }

  public async listMembers(accountId: string): Promise<readonly AdAccountMemberRecord[]> {
    return (await prisma().adAccountMember.findMany({ where: { accountId }, orderBy: { addedAt: "asc" } })).map(toMember);
  }

  public async listMembershipsForUser(userId: string): Promise<readonly AdAccountMemberRecord[]> {
    return (await prisma().adAccountMember.findMany({ where: { userId } })).map(toMember);
  }

  public async findAccountsByIds(accountIds: readonly string[]): Promise<readonly AdAccountRecord[]> {
    return (await prisma().adAccount.findMany({ where: { id: { in: [...accountIds] } } })).map(toAccount);
  }

  public async addMember(accountId: string, userId: string, role: AdAccountRole, now: Date): Promise<AdAccountMemberRecord> {
    const row = await prisma().adAccountMember.upsert({
      where: { accountId_userId: { accountId, userId } },
      create: { accountId, userId, role, addedAt: now },
      update: { role },
    });
    return toMember(row);
  }

  public async changeMemberRole(accountId: string, userId: string, role: AdAccountRole): Promise<AdAccountMemberRecord> {
    return toMember(await prisma().adAccountMember.update({ where: { accountId_userId: { accountId, userId } }, data: { role } }));
  }

  public async removeMember(accountId: string, userId: string): Promise<void> {
    await prisma().adAccountMember.deleteMany({ where: { accountId, userId } });
  }

  public async touchMember(accountId: string, userId: string, now: Date): Promise<void> {
    await prisma().adAccountMember.updateMany({ where: { accountId, userId }, data: { lastActiveAt: now } });
  }
}
