import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { AdAccountInviteRecord, AdAccountRole, AdActivityObjectType, AdActivityRecord, InviteStatus, NewAdActivityInput } from "../models/adAccounts.model.js";
import type { AdInvitesRepository, NewAdInviteInput } from "./adInvites.repository.js";

type InviteRow = Awaited<ReturnType<ReturnType<typeof prisma>["adAccountInvite"]["create"]>>;
type ActivityRow = Awaited<ReturnType<ReturnType<typeof prisma>["adActivity"]["create"]>>;

function toInvite(row: InviteRow): AdAccountInviteRecord {
  return { ...row, role: row.role as AdAccountRole, status: row.status as InviteStatus };
}

function toActivity(row: ActivityRow): AdActivityRecord {
  return { ...row, objectType: row.objectType as AdActivityObjectType, changes: row.changes as unknown as AdActivityRecord["changes"] };
}

export class PrismaAdInvitesRepository implements AdInvitesRepository {
  public async createInvite(input: NewAdInviteInput): Promise<AdAccountInviteRecord> {
    return toInvite(await prisma().adAccountInvite.create({ data: { ...input, status: "pending" } }));
  }

  public async findInviteById(inviteId: string): Promise<AdAccountInviteRecord | undefined> {
    const row = await prisma().adAccountInvite.findUnique({ where: { id: inviteId } });
    return row === null ? undefined : toInvite(row);
  }

  public async findInviteByTokenHash(tokenHash: string): Promise<AdAccountInviteRecord | undefined> {
    const row = await prisma().adAccountInvite.findUnique({ where: { tokenHash } });
    return row === null ? undefined : toInvite(row);
  }

  public async listInvites(accountId: string, status: InviteStatus): Promise<readonly AdAccountInviteRecord[]> {
    return (await prisma().adAccountInvite.findMany({ where: { accountId, status }, orderBy: { createdAt: "desc" } })).map(toInvite);
  }

  public async changeInviteStatus(inviteId: string, status: InviteStatus): Promise<void> {
    await prisma().adAccountInvite.updateMany({ where: { id: inviteId }, data: { status } });
  }

  public async recordActivity(input: NewAdActivityInput): Promise<AdActivityRecord> {
    return toActivity(await prisma().adActivity.create({ data: { ...input, changes: input.changes as unknown as Prisma.InputJsonValue } }));
  }

  public async listActivity(accountId: string, objectType: string | undefined): Promise<readonly AdActivityRecord[]> {
    const rows = await prisma().adActivity.findMany({
      where: { accountId, ...(objectType === undefined ? {} : { objectType }) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1_000,
    });
    return rows.map(toActivity);
  }
}
