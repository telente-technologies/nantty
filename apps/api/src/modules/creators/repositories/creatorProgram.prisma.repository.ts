import type { CreatorApplication } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type { CreatorApplicationRecord, CreatorApplicationStatus, CreatorEligibility, CreatorProfileRecord } from "../models/creators.model.js";
import type { CreatorApplicationReview, CreatorProgramRepository, NewCreatorApplication, NewCreatorViolation } from "./creatorProgram.repository.js";

function convertApplicationRowToRecord(row: CreatorApplication): CreatorApplicationRecord {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status as CreatorApplicationStatus,
    eligibility: row.eligibility as unknown as CreatorEligibility,
    reviewerId: row.reviewerId,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
  };
}

export class PrismaCreatorProgramRepository implements CreatorProgramRepository {
  public async createApplication(input: NewCreatorApplication): Promise<CreatorApplicationRecord> {
    const row = await prisma().creatorApplication.create({ data: { userId: input.userId, eligibility: JSON.parse(JSON.stringify(input.eligibility)), createdAt: input.createdAt } });
    return convertApplicationRowToRecord(row);
  }

  public async findApplication(applicationId: string): Promise<CreatorApplicationRecord | undefined> {
    const row = await prisma().creatorApplication.findUnique({ where: { id: applicationId } });
    return row === null ? undefined : convertApplicationRowToRecord(row);
  }

  public async findLatestApplicationForUser(userId: string): Promise<CreatorApplicationRecord | undefined> {
    const row = await prisma().creatorApplication.findFirst({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    return row === null ? undefined : convertApplicationRowToRecord(row);
  }

  public async listApplications(status: CreatorApplicationStatus | undefined, page: PageRequest): Promise<Page<CreatorApplicationRecord>> {
    const rows = await prisma().creatorApplication.findMany({
      where: status === undefined ? {} : { status },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertApplicationRowToRecord);
  }

  public async markApplicationReviewedIfPending(applicationId: string, review: CreatorApplicationReview): Promise<boolean> {
    return (await prisma().creatorApplication.updateMany({ where: { id: applicationId, status: "pending" }, data: { ...review } })).count === 1;
  }

  public async findProfile(userId: string): Promise<CreatorProfileRecord | undefined> {
    const row = await prisma().creatorProfile.findUnique({ where: { userId } });
    return row === null ? undefined : { ...row, status: row.status === "suspended" ? "suspended" : "approved" };
  }

  public async saveProfile(profile: CreatorProfileRecord): Promise<void> {
    await prisma().creatorProfile.upsert({ where: { userId: profile.userId }, create: { ...profile }, update: { ...profile } });
  }

  public async recordViolation(violation: NewCreatorViolation): Promise<void> {
    await prisma().creatorViolation.create({ data: { ...violation } });
  }

  public async countViolationsSince(userId: string, since: Date): Promise<number> {
    return prisma().creatorViolation.count({ where: { userId, createdAt: { gte: since } } });
  }
}
