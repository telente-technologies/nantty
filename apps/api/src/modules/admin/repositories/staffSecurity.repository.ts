import { randomUUID } from "node:crypto";

import type {
  NewStaffSessionInput,
  NewWebAuthnCredentialInput,
  StaffChallengeRecord,
  StaffInvitationRecord,
  StaffSessionChanges,
  StaffSessionRecord,
  WebAuthnCredentialRecord,
} from "../models/platformStaff.model.js";

export interface StaffSecurityRepository {
  createInvitation(staffId: string, tokenHash: string, expiresAt: Date, createdById: string | null, now: Date): Promise<StaffInvitationRecord>;
  findInvitationByTokenHash(tokenHash: string): Promise<StaffInvitationRecord | undefined>;
  markInvitationAccepted(id: string, now: Date): Promise<boolean>;
  revokeInvitationsForStaff(staffId: string, now: Date): Promise<void>;
  createChallenge(staffId: string, tokenHash: string, expiresAt: Date, now: Date): Promise<StaffChallengeRecord>;
  findUsableChallenge(tokenHash: string, now: Date): Promise<StaffChallengeRecord | undefined>;
  countFailedChallengeAttempt(id: string): Promise<number>;
  storeChallengeWebAuthnChallenge(id: string, challenge: string): Promise<void>;
  consumeChallenge(id: string, now: Date): Promise<boolean>;
  createSession(input: NewStaffSessionInput): Promise<StaffSessionRecord>;
  findSession(id: string): Promise<StaffSessionRecord | undefined>;
  listActiveSessions(staffId: string, now: Date): Promise<readonly StaffSessionRecord[]>;
  replaceRefreshTokenHash(id: string, expectedHash: string, nextHash: string, usedAt: Date): Promise<boolean>;
  updateSession(id: string, changes: StaffSessionChanges): Promise<void>;
  revokeSession(id: string, reason: string, now: Date): Promise<void>;
  revokeAllSessions(staffId: string, reason: string, now: Date): Promise<void>;
  listWebAuthnCredentials(staffId: string): Promise<readonly WebAuthnCredentialRecord[]>;
  findWebAuthnCredential(credentialId: string): Promise<WebAuthnCredentialRecord | undefined>;
  addWebAuthnCredential(input: NewWebAuthnCredentialInput, now: Date): Promise<WebAuthnCredentialRecord>;
  recordWebAuthnCredentialUse(id: string, signCount: number, now: Date): Promise<void>;
  removeWebAuthnCredential(staffId: string, id: string): Promise<boolean>;
  removeAllWebAuthnCredentials(staffId: string): Promise<void>;
}

export class InMemoryStaffSecurityRepository implements StaffSecurityRepository {
  private readonly invitations = new Map<string, StaffInvitationRecord>();
  private readonly challenges = new Map<string, StaffChallengeRecord>();
  private readonly sessions = new Map<string, StaffSessionRecord>();
  private readonly credentials = new Map<string, WebAuthnCredentialRecord>();

  public async createInvitation(staffId: string, tokenHash: string, expiresAt: Date, createdById: string | null, now: Date): Promise<StaffInvitationRecord> {
    const invitation: StaffInvitationRecord = { id: randomUUID(), staffId, tokenHash, expiresAt, acceptedAt: null, revokedAt: null, createdById, createdAt: now };
    this.invitations.set(invitation.id, invitation);
    return invitation;
  }

  public async findInvitationByTokenHash(tokenHash: string): Promise<StaffInvitationRecord | undefined> {
    return [...this.invitations.values()].find((invitation) => invitation.tokenHash === tokenHash);
  }

  public async markInvitationAccepted(id: string, now: Date): Promise<boolean> {
    const invitation = this.invitations.get(id);
    if (invitation === undefined || invitation.acceptedAt !== null || invitation.revokedAt !== null) return false;
    this.invitations.set(id, { ...invitation, acceptedAt: now });
    return true;
  }

  public async revokeInvitationsForStaff(staffId: string, now: Date): Promise<void> {
    for (const invitation of this.invitations.values()) {
      if (invitation.staffId === staffId && invitation.acceptedAt === null && invitation.revokedAt === null) this.invitations.set(invitation.id, { ...invitation, revokedAt: now });
    }
  }

  public async createChallenge(staffId: string, tokenHash: string, expiresAt: Date, now: Date): Promise<StaffChallengeRecord> {
    const challenge: StaffChallengeRecord = { id: randomUUID(), staffId, tokenHash, attempts: 0, webAuthnChallenge: null, expiresAt, consumedAt: null, createdAt: now };
    this.challenges.set(challenge.id, challenge);
    return challenge;
  }

  public async findUsableChallenge(tokenHash: string, now: Date): Promise<StaffChallengeRecord | undefined> {
    return [...this.challenges.values()].find((challenge) => challenge.tokenHash === tokenHash && challenge.consumedAt === null && challenge.expiresAt > now);
  }

  public async countFailedChallengeAttempt(id: string): Promise<number> {
    const challenge = this.challenges.get(id);
    if (challenge === undefined) return Number.MAX_SAFE_INTEGER;
    this.challenges.set(id, { ...challenge, attempts: challenge.attempts + 1 });
    return challenge.attempts + 1;
  }

  public async storeChallengeWebAuthnChallenge(id: string, webAuthnChallenge: string): Promise<void> {
    const challenge = this.challenges.get(id);
    if (challenge !== undefined) this.challenges.set(id, { ...challenge, webAuthnChallenge });
  }

  public async consumeChallenge(id: string, now: Date): Promise<boolean> {
    const challenge = this.challenges.get(id);
    if (challenge === undefined || challenge.consumedAt !== null) return false;
    this.challenges.set(id, { ...challenge, consumedAt: now });
    return true;
  }

  public async createSession(input: NewStaffSessionInput): Promise<StaffSessionRecord> {
    const session: StaffSessionRecord = {
      ...input,
      stepUpTokenHash: null,
      stepUpExpiresAt: null,
      webAuthnChallenge: null,
      webAuthnChallengeExpiresAt: null,
      lastSeenAt: input.createdAt,
      revokedAt: null,
      revokedReason: null,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  public async findSession(id: string): Promise<StaffSessionRecord | undefined> {
    return this.sessions.get(id);
  }

  public async listActiveSessions(staffId: string, now: Date): Promise<readonly StaffSessionRecord[]> {
    return [...this.sessions.values()]
      .filter((session) => session.staffId === staffId && session.revokedAt === null && session.expiresAt > now)
      .sort((left, right) => right.lastSeenAt.getTime() - left.lastSeenAt.getTime());
  }

  public async replaceRefreshTokenHash(id: string, expectedHash: string, nextHash: string, usedAt: Date): Promise<boolean> {
    const session = this.sessions.get(id);
    if (session === undefined || session.revokedAt !== null || session.refreshTokenHash !== expectedHash) return false;
    this.sessions.set(id, { ...session, refreshTokenHash: nextHash, lastSeenAt: usedAt });
    return true;
  }

  public async updateSession(id: string, changes: StaffSessionChanges): Promise<void> {
    const session = this.sessions.get(id);
    if (session !== undefined) this.sessions.set(id, { ...session, ...changes });
  }

  public async revokeSession(id: string, reason: string, now: Date): Promise<void> {
    const session = this.sessions.get(id);
    if (session !== undefined && session.revokedAt === null) this.sessions.set(id, { ...session, revokedAt: now, revokedReason: reason });
  }

  public async revokeAllSessions(staffId: string, reason: string, now: Date): Promise<void> {
    for (const session of this.sessions.values()) if (session.staffId === staffId) await this.revokeSession(session.id, reason, now);
  }

  public async listWebAuthnCredentials(staffId: string): Promise<readonly WebAuthnCredentialRecord[]> {
    return [...this.credentials.values()].filter((credential) => credential.staffId === staffId);
  }

  public async findWebAuthnCredential(credentialId: string): Promise<WebAuthnCredentialRecord | undefined> {
    return [...this.credentials.values()].find((credential) => credential.credentialId === credentialId);
  }

  public async addWebAuthnCredential(input: NewWebAuthnCredentialInput, now: Date): Promise<WebAuthnCredentialRecord> {
    const credential: WebAuthnCredentialRecord = { ...input, transports: [...input.transports], id: randomUUID(), createdAt: now, lastUsedAt: null };
    this.credentials.set(credential.id, credential);
    return credential;
  }

  public async recordWebAuthnCredentialUse(id: string, signCount: number, now: Date): Promise<void> {
    const credential = this.credentials.get(id);
    if (credential !== undefined) this.credentials.set(id, { ...credential, signCount, lastUsedAt: now });
  }

  public async removeWebAuthnCredential(staffId: string, id: string): Promise<boolean> {
    const credential = this.credentials.get(id);
    if (credential === undefined || credential.staffId !== staffId) return false;
    return this.credentials.delete(id);
  }

  public async removeAllWebAuthnCredentials(staffId: string): Promise<void> {
    for (const credential of [...this.credentials.values()]) if (credential.staffId === staffId) this.credentials.delete(credential.id);
  }
}
