import { ConflictError } from "@zudojs/errors";

import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import type { PlatformStaffAccount, WebAuthnCredential } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { PlatformRole } from "../../../constants/platformRoles.constant.js";
import type {
  NewStaffAccountInput,
  NewWebAuthnCredentialInput,
  StaffAccountChanges,
  StaffAccountRecord,
  StaffLoginChallengeRecord,
  StaffSessionRecord,
  WebAuthnCredentialRecord,
} from "../models/platformStaff.model.js";
import type { StaffAccountsRepository, StaffSecurityRepository } from "./platformStaff.repository.js";

function convertStaffAccountRowToRecord(row: PlatformStaffAccount): StaffAccountRecord {
  return { ...row, role: row.role as PlatformRole, status: row.status === "disabled" ? "disabled" : "active" };
}

function convertCredentialRowToRecord(row: WebAuthnCredential): WebAuthnCredentialRecord {
  return { ...row };
}

export class PrismaStaffAccountsRepository implements StaffAccountsRepository {
  public async findByUserId(userId: string): Promise<StaffAccountRecord | undefined> {
    const row = await prisma().platformStaffAccount.findUnique({ where: { userId } });
    return row === null ? undefined : convertStaffAccountRowToRecord(row);
  }

  public async listAll(): Promise<readonly StaffAccountRecord[]> {
    const rows = await prisma().platformStaffAccount.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(convertStaffAccountRowToRecord);
  }

  public async create(input: NewStaffAccountInput, now: Date): Promise<StaffAccountRecord> {
    try {
      const row = await prisma().platformStaffAccount.create({
        data: { ...input, permissions: [...input.permissions], ipAllowList: [...input.ipAllowList], createdAt: now },
      });
      return convertStaffAccountRowToRecord(row);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw new ConflictError("This user already has a staff account.");
      throw error;
    }
  }

  public async update(userId: string, changes: StaffAccountChanges, now: Date): Promise<StaffAccountRecord | undefined> {
    const { permissions, ipAllowList, recoveryCodeHashes, ...rest } = changes;
    const result = await prisma().platformStaffAccount.updateMany({
      where: { userId },
      data: {
        ...rest,
        ...(permissions === undefined ? {} : { permissions: [...permissions] }),
        ...(ipAllowList === undefined ? {} : { ipAllowList: [...ipAllowList] }),
        ...(recoveryCodeHashes === undefined ? {} : { recoveryCodeHashes: [...recoveryCodeHashes] }),
        updatedAt: now,
      },
    });
    return result.count === 0 ? undefined : this.findByUserId(userId);
  }
}

export class PrismaStaffSecurityRepository implements StaffSecurityRepository {
  public async createLoginChallenge(userId: string, tokenHash: string, expiresAt: Date, now: Date): Promise<StaffLoginChallengeRecord> {
    return prisma().platformStaffLoginChallenge.create({ data: { userId, tokenHash, expiresAt, createdAt: now } });
  }

  public async findUsableLoginChallenge(tokenHash: string, now: Date): Promise<StaffLoginChallengeRecord | undefined> {
    const row = await prisma().platformStaffLoginChallenge.findFirst({ where: { tokenHash, consumedAt: null, expiresAt: { gt: now } } });
    return row ?? undefined;
  }

  public async countFailedLoginChallengeAttempt(id: string): Promise<number> {
    const row = await prisma().platformStaffLoginChallenge.update({ where: { id }, data: { attempts: { increment: 1 } } });
    return row.attempts;
  }

  public async consumeLoginChallenge(id: string, now: Date): Promise<boolean> {
    const result = await prisma().platformStaffLoginChallenge.updateMany({ where: { id, consumedAt: null }, data: { consumedAt: now } });
    return result.count === 1;
  }

  public async createStaffSession(session: StaffSessionRecord): Promise<void> {
    await prisma().platformStaffSession.create({ data: { ...session } });
  }

  public async findStaffSession(sessionId: string): Promise<StaffSessionRecord | undefined> {
    return (await prisma().platformStaffSession.findUnique({ where: { sessionId } })) ?? undefined;
  }

  public async markStaffSessionSteppedUp(sessionId: string, at: Date): Promise<void> {
    await prisma().platformStaffSession.updateMany({ where: { sessionId }, data: { stepUpVerifiedAt: at } });
  }

  public async listWebAuthnCredentials(userId: string): Promise<readonly WebAuthnCredentialRecord[]> {
    const rows = await prisma().webAuthnCredential.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    return rows.map(convertCredentialRowToRecord);
  }

  public async addWebAuthnCredential(input: NewWebAuthnCredentialInput, now: Date): Promise<WebAuthnCredentialRecord> {
    const row = await prisma().webAuthnCredential.create({ data: { ...input, transports: [...input.transports], createdAt: now } });
    return convertCredentialRowToRecord(row);
  }

  public async removeWebAuthnCredential(userId: string, id: string): Promise<boolean> {
    const result = await prisma().webAuthnCredential.deleteMany({ where: { id, userId } });
    return result.count === 1;
  }
}
