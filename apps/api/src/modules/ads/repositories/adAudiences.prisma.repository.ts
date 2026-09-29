import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { CustomAudienceChanges, CustomAudienceRecord, CustomAudienceStatus, CustomAudienceType, CustomAudienceDefinition, NewCustomAudienceInput } from "../models/adAudiences.model.js";
import type { AdAudiencesRepository } from "./adAudiences.repository.js";

type AudienceRow = Awaited<ReturnType<ReturnType<typeof prisma>["adCustomAudience"]["create"]>>;

function toAudience(row: AudienceRow): CustomAudienceRecord {
  return { ...row, type: row.type as CustomAudienceType, status: row.status as CustomAudienceStatus, definition: row.definition as unknown as CustomAudienceDefinition };
}

export class PrismaAdAudiencesRepository implements AdAudiencesRepository {
  public async createAudience(input: NewCustomAudienceInput, now: Date): Promise<CustomAudienceRecord> {
    const row = await prisma().adCustomAudience.create({
      data: { ...input, definition: input.definition as unknown as Prisma.InputJsonValue, matchedUserIds: [...input.matchedUserIds], createdAt: now, updatedAt: now },
    });
    return toAudience(row);
  }

  public async findAudience(audienceId: string): Promise<CustomAudienceRecord | undefined> {
    const row = await prisma().adCustomAudience.findUnique({ where: { id: audienceId } });
    return row === null ? undefined : toAudience(row);
  }

  public async listAudiences(accountId: string): Promise<readonly CustomAudienceRecord[]> {
    return (await prisma().adCustomAudience.findMany({ where: { accountId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] })).map(toAudience);
  }

  public async updateAudience(audienceId: string, changes: CustomAudienceChanges, now: Date): Promise<CustomAudienceRecord> {
    const { matchedUserIds, ...rest } = changes;
    const row = await prisma().adCustomAudience.update({
      where: { id: audienceId },
      data: { ...rest, ...(matchedUserIds === undefined ? {} : { matchedUserIds: [...matchedUserIds] }), updatedAt: now },
    });
    return toAudience(row);
  }

  public async deleteAudience(audienceId: string): Promise<void> {
    await prisma().$transaction([
      prisma().adCustomerListHash.deleteMany({ where: { audienceId } }),
      prisma().adCustomAudience.deleteMany({ where: { id: audienceId } }),
    ]);
  }

  public async replaceCustomerListHashes(audienceId: string, hashes: readonly string[]): Promise<void> {
    await prisma().$transaction([
      prisma().adCustomerListHash.deleteMany({ where: { audienceId } }),
      prisma().adCustomerListHash.createMany({ data: [...new Set(hashes)].map((identifierHash) => ({ audienceId, identifierHash })), skipDuplicates: true }),
    ]);
  }

  public async countCustomerListHashes(audienceId: string): Promise<number> {
    return prisma().adCustomerListHash.count({ where: { audienceId } });
  }
}
