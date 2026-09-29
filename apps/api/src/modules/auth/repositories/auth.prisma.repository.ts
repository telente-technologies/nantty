import { prisma } from "../../../integrations/database.integration.js";
import type { NewSessionInput, OtpRecord, StoredCodePurpose, SessionRecord, SocialProvider } from "../models/auth.model.js";
import type { OneTimeCodesRepository, SessionsRepository, SocialIdentitiesRepository } from "./auth.repository.js";

function convertOtpRowToRecord(row: Omit<OtpRecord, "purpose"> & { purpose: string }): OtpRecord {
  return { ...row, purpose: row.purpose as StoredCodePurpose };
}

export class PrismaSessionsRepository implements SessionsRepository {
  public async create(input: NewSessionInput): Promise<SessionRecord> {
    return prisma().session.create({ data: { ...input } });
  }

  public async findById(id: string): Promise<SessionRecord | undefined> {
    return (await prisma().session.findUnique({ where: { id } })) ?? undefined;
  }

  public async replaceRefreshTokenHash(id: string, expectedHash: string, nextHash: string, usedAt: Date): Promise<boolean> {
    const result = await prisma().session.updateMany({
      where: { id, refreshTokenHash: expectedHash, revokedAt: null },
      data: { refreshTokenHash: nextHash, lastUsedAt: usedAt },
    });
    return result.count === 1;
  }

  public async revoke(id: string, reason: string, revokedAt: Date): Promise<void> {
    await prisma().session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt, revokedReason: reason } });
  }

  public async revokeAllForUser(userId: string, reason: string, revokedAt: Date): Promise<void> {
    await prisma().session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt, revokedReason: reason } });
  }

  public async listActiveForUser(userId: string, now: Date): Promise<readonly SessionRecord[]> {
    return prisma().session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { lastUsedAt: "desc" },
    });
  }
}

export class PrismaOneTimeCodesRepository implements OneTimeCodesRepository {
  public async replaceActiveCode(target: string, purpose: StoredCodePurpose, codeHash: string, expiresAt: Date, now: Date): Promise<OtpRecord> {
    const [, row] = await prisma().$transaction([
      prisma().otpCode.updateMany({ where: { target, purpose, consumedAt: null }, data: { consumedAt: now } }),
      prisma().otpCode.create({ data: { target, purpose, codeHash, expiresAt } }),
    ]);
    return convertOtpRowToRecord(row);
  }

  public async findLatestActiveCode(target: string, purpose: StoredCodePurpose, now: Date): Promise<OtpRecord | undefined> {
    const row = await prisma().otpCode.findFirst({
      where: { target, purpose, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
    });
    return row === null ? undefined : convertOtpRowToRecord(row);
  }

  public async findLatestCode(target: string, purpose: StoredCodePurpose): Promise<OtpRecord | undefined> {
    const row = await prisma().otpCode.findFirst({ where: { target, purpose }, orderBy: { createdAt: "desc" } });
    return row === null ? undefined : convertOtpRowToRecord(row);
  }

  public async findActiveCodeByHash(purpose: StoredCodePurpose, codeHash: string, now: Date): Promise<OtpRecord | undefined> {
    const row = await prisma().otpCode.findFirst({ where: { purpose, codeHash, consumedAt: null, expiresAt: { gt: now } } });
    return row === null ? undefined : convertOtpRowToRecord(row);
  }

  public async incrementFailedAttempts(id: string): Promise<number> {
    const row = await prisma().otpCode.update({ where: { id }, data: { attempts: { increment: 1 } } });
    return row.attempts;
  }

  public async consumeCode(id: string, consumedAt: Date): Promise<boolean> {
    const result = await prisma().otpCode.updateMany({ where: { id, consumedAt: null }, data: { consumedAt } });
    return result.count === 1;
  }
}

export class PrismaSocialIdentitiesRepository implements SocialIdentitiesRepository {
  public async findUserIdForIdentity(provider: SocialProvider, subject: string): Promise<string | undefined> {
    const row = await prisma().authIdentity.findUnique({ where: { provider_subject: { provider, subject } } });
    return row?.userId;
  }

  public async linkIdentity(userId: string, provider: SocialProvider, subject: string): Promise<void> {
    await prisma().authIdentity.upsert({
      where: { provider_subject: { provider, subject } },
      create: { userId, provider, subject },
      update: {},
    });
  }
}
