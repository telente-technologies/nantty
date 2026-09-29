import { Prisma, type ProfileVerification } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type {
  ProfileType,
  VerificationColor,
  VerificationStatus,
  VerificationTier,
  VerificationType,
} from "../../../interfaces/verificationBadge.interface.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type { NewVerification, ProfileKind, VerificationDetails, VerificationFilter, VerificationPatch, VerificationRecord } from "../models/verifications.model.js";
import type { VerificationsRepository } from "./verifications.repository.js";

function convertVerificationRowToRecord(row: ProfileVerification): VerificationRecord {
  return {
    ...row,
    profileKind: row.profileKind as ProfileKind,
    profileType: row.profileType as ProfileType,
    verificationType: row.verificationType as VerificationType,
    color: row.color as VerificationColor,
    status: row.status as VerificationStatus,
    tier: row.tier as VerificationTier | null,
    details: row.details as unknown as VerificationDetails | null,
  };
}

function convertDetailsToJson(details: VerificationDetails | null | undefined) {
  if (details === undefined) return {};
  return { details: details === null ? Prisma.JsonNull : (details as unknown as Prisma.InputJsonValue) };
}

export class PrismaVerificationsRepository implements VerificationsRepository {
  public async findByProfileId(profileId: string): Promise<VerificationRecord | undefined> {
    const row = await prisma().profileVerification.findUnique({ where: { profileId } });
    return row === null ? undefined : convertVerificationRowToRecord(row);
  }

  public async findManyByProfileIds(profileIds: readonly string[]): Promise<readonly VerificationRecord[]> {
    const rows = await prisma().profileVerification.findMany({ where: { profileId: { in: [...profileIds] } } });
    return rows.map(convertVerificationRowToRecord);
  }

  public async create(input: NewVerification): Promise<VerificationRecord> {
    const { details, ...rest } = input;
    return convertVerificationRowToRecord(await prisma().profileVerification.create({ data: { ...rest, ...convertDetailsToJson(details) } }));
  }

  public async update(profileId: string, patch: VerificationPatch, updatedAt: Date): Promise<VerificationRecord> {
    const { details, ...rest } = patch;
    return convertVerificationRowToRecord(await prisma().profileVerification.update({ where: { profileId }, data: { ...rest, ...convertDetailsToJson(details), updatedAt } }));
  }

  public async list(filter: VerificationFilter, page: PageRequest): Promise<Page<VerificationRecord>> {
    const rows = await prisma().profileVerification.findMany({
      where: { ...(filter.status === undefined ? {} : { status: filter.status }), ...(filter.type === undefined ? {} : { verificationType: filter.type }) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertVerificationRowToRecord);
  }
}
