import { Prisma, type SellerApplication } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type { NewSellerApplicationInput, SellerApplicationRecord, SellerApplicationStatus, SellerOnboardingDetails } from "../models/stores.model.js";
import type { SellerApplicationReview, SellerApplicationsRepository } from "./sellerApplications.repository.js";

function convertApplicationRowToRecord(row: SellerApplication): SellerApplicationRecord {
  const { phoneEnc, status, onboarding, ...rest } = row;
  return { ...rest, phoneEncrypted: phoneEnc, status: status as SellerApplicationStatus, onboarding: onboarding as unknown as SellerOnboardingDetails | null };
}

export class PrismaSellerApplicationsRepository implements SellerApplicationsRepository {
  public async create(input: NewSellerApplicationInput): Promise<SellerApplicationRecord> {
    const { phoneEncrypted, onboarding, ...rest } = input;
    const onboardingJson = onboarding === null ? Prisma.JsonNull : (onboarding as unknown as Prisma.InputJsonValue);
    return convertApplicationRowToRecord(await prisma().sellerApplication.create({ data: { ...rest, phoneEnc: phoneEncrypted, onboarding: onboardingJson } }));
  }

  public async findById(id: string): Promise<SellerApplicationRecord | undefined> {
    const row = await prisma().sellerApplication.findUnique({ where: { id } });
    return row === null ? undefined : convertApplicationRowToRecord(row);
  }

  public async listForUser(userId: string): Promise<readonly SellerApplicationRecord[]> {
    const rows = await prisma().sellerApplication.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    return rows.map(convertApplicationRowToRecord);
  }

  public async list(status: SellerApplicationStatus | undefined, page: PageRequest): Promise<Page<SellerApplicationRecord>> {
    const rows = await prisma().sellerApplication.findMany({
      where: status === undefined ? {} : { status },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertApplicationRowToRecord);
  }

  public async markReviewedIfPending(id: string, review: SellerApplicationReview): Promise<boolean> {
    const result = await prisma().sellerApplication.updateMany({ where: { id, status: "pending" }, data: { ...review } });
    return result.count === 1;
  }
}
