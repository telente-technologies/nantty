import { prisma } from "../../../integrations/database.integration.js";
import type {
  NewStaffSessionInput,
  NewWebAuthnCredentialInput,
  StaffChallengeRecord,
  StaffInvitationRecord,
  StaffSessionChanges,
  StaffSessionRecord,
  WebAuthnCredentialRecord,
} from "../models/platformStaff.model.js";
import type { StaffSecurityRepository } from "./staffSecurity.repository.js";

export class PrismaStaffSecurityRepository implements StaffSecurityRepository {
  public async createInvitation(staffId: string, tokenHash: string, expiresAt: Date, createdById: string | null, now: Date): Promise<StaffInvitationRecord> {
    return prisma().platformStaffInvitation.create({ data: { staffId, tokenHash, expiresAt, createdById, createdAt: now } });
  }

  public async findInvitationByTokenHash(tokenHash: string): Promise<StaffInvitationRecord | undefined> {
    return (await prisma().platformStaffInvitation.findUnique({ where: { tokenHash } })) ?? undefined;
  }

  public async markInvitationAccepted(id: string, now: Date): Promise<boolean> {
    const result = await prisma().platformStaffInvitation.updateMany({ where: { id, acceptedAt: null, revokedAt: null }, data: { acceptedAt: now } });
    return result.count === 1;
  }

  public async revokeInvitationsForStaff(staffId: string, now: Date): Promise<void> {
    await prisma().platformStaffInvitation.updateMany({ where: { staffId, acceptedAt: null, revokedAt: null }, data: { revokedAt: now } });
  }

  public async createChallenge(staffId: string, tokenHash: string, expiresAt: Date, now: Date): Promise<StaffChallengeRecord> {
    return prisma().platformStaffChallenge.create({ data: { staffId, tokenHash, expiresAt, createdAt: now } });
  }

  public async findUsableChallenge(tokenHash: string, now: Date): Promise<StaffChallengeRecord | undefined> {
    return (await prisma().platformStaffChallenge.findFirst({ where: { tokenHash, consumedAt: null, expiresAt: { gt: now } } })) ?? undefined;
  }

  public async countFailedChallengeAttempt(id: string): Promise<number> {
    return (await prisma().platformStaffChallenge.update({ where: { id }, data: { attempts: { increment: 1 } } })).attempts;
  }

  public async storeChallengeWebAuthnChallenge(id: string, webAuthnChallenge: string): Promise<void> {
    await prisma().platformStaffChallenge.updateMany({ where: { id }, data: { webAuthnChallenge } });
  }

  public async consumeChallenge(id: string, now: Date): Promise<boolean> {
    const result = await prisma().platformStaffChallenge.updateMany({ where: { id, consumedAt: null }, data: { consumedAt: now } });
    return result.count === 1;
  }

  public async createSession(input: NewStaffSessionInput): Promise<StaffSessionRecord> {
    return prisma().platformStaffSession.create({ data: { ...input, lastSeenAt: input.createdAt } });
  }

  public async findSession(id: string): Promise<StaffSessionRecord | undefined> {
    return (await prisma().platformStaffSession.findUnique({ where: { id } })) ?? undefined;
  }

  public async listActiveSessions(staffId: string, now: Date): Promise<readonly StaffSessionRecord[]> {
    return prisma().platformStaffSession.findMany({ where: { staffId, revokedAt: null, expiresAt: { gt: now } }, orderBy: { lastSeenAt: "desc" } });
  }

  public async replaceRefreshTokenHash(id: string, expectedHash: string, nextHash: string, usedAt: Date): Promise<boolean> {
    const result = await prisma().platformStaffSession.updateMany({
      where: { id, refreshTokenHash: expectedHash, revokedAt: null },
      data: { refreshTokenHash: nextHash, lastSeenAt: usedAt },
    });
    return result.count === 1;
  }

  public async updateSession(id: string, changes: StaffSessionChanges): Promise<void> {
    await prisma().platformStaffSession.updateMany({ where: { id }, data: { ...changes } });
  }

  public async revokeSession(id: string, reason: string, now: Date): Promise<void> {
    await prisma().platformStaffSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now, revokedReason: reason } });
  }

  public async revokeAllSessions(staffId: string, reason: string, now: Date): Promise<void> {
    await prisma().platformStaffSession.updateMany({ where: { staffId, revokedAt: null }, data: { revokedAt: now, revokedReason: reason } });
  }

  public async listWebAuthnCredentials(staffId: string): Promise<readonly WebAuthnCredentialRecord[]> {
    return prisma().webAuthnCredential.findMany({ where: { staffId }, orderBy: { createdAt: "asc" } });
  }

  public async findWebAuthnCredential(credentialId: string): Promise<WebAuthnCredentialRecord | undefined> {
    return (await prisma().webAuthnCredential.findUnique({ where: { credentialId } })) ?? undefined;
  }

  public async addWebAuthnCredential(input: NewWebAuthnCredentialInput, now: Date): Promise<WebAuthnCredentialRecord> {
    return prisma().webAuthnCredential.create({ data: { ...input, transports: [...input.transports], createdAt: now } });
  }

  public async recordWebAuthnCredentialUse(id: string, signCount: number, now: Date): Promise<void> {
    await prisma().webAuthnCredential.updateMany({ where: { id }, data: { signCount, lastUsedAt: now } });
  }

  public async removeWebAuthnCredential(staffId: string, id: string): Promise<boolean> {
    const result = await prisma().webAuthnCredential.deleteMany({ where: { id, staffId } });
    return result.count === 1;
  }

  public async removeAllWebAuthnCredentials(staffId: string): Promise<void> {
    await prisma().webAuthnCredential.deleteMany({ where: { staffId } });
  }
}
