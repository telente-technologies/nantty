import { randomUUID } from "node:crypto";

import { ConflictError } from "@zudojs/errors";

import type {
  NewStaffAccountInput,
  NewWebAuthnCredentialInput,
  StaffAccountChanges,
  StaffAccountRecord,
  StaffLoginChallengeRecord,
  StaffSessionRecord,
  WebAuthnCredentialRecord,
} from "../models/platformStaff.model.js";

export interface StaffAccountsRepository {
  findByUserId(userId: string): Promise<StaffAccountRecord | undefined>;
  listAll(): Promise<readonly StaffAccountRecord[]>;
  create(input: NewStaffAccountInput, now: Date): Promise<StaffAccountRecord>;
  update(userId: string, changes: StaffAccountChanges, now: Date): Promise<StaffAccountRecord | undefined>;
}

export interface StaffSecurityRepository {
  createLoginChallenge(userId: string, tokenHash: string, expiresAt: Date, now: Date): Promise<StaffLoginChallengeRecord>;
  findUsableLoginChallenge(tokenHash: string, now: Date): Promise<StaffLoginChallengeRecord | undefined>;
  countFailedLoginChallengeAttempt(id: string): Promise<number>;
  consumeLoginChallenge(id: string, now: Date): Promise<boolean>;
  createStaffSession(session: StaffSessionRecord): Promise<void>;
  findStaffSession(sessionId: string): Promise<StaffSessionRecord | undefined>;
  markStaffSessionSteppedUp(sessionId: string, at: Date): Promise<void>;
  listWebAuthnCredentials(userId: string): Promise<readonly WebAuthnCredentialRecord[]>;
  addWebAuthnCredential(input: NewWebAuthnCredentialInput, now: Date): Promise<WebAuthnCredentialRecord>;
  removeWebAuthnCredential(userId: string, id: string): Promise<boolean>;
}

export class InMemoryStaffAccountsRepository implements StaffAccountsRepository {
  private readonly accounts = new Map<string, StaffAccountRecord>();

  public async findByUserId(userId: string): Promise<StaffAccountRecord | undefined> {
    return this.accounts.get(userId);
  }

  public async listAll(): Promise<readonly StaffAccountRecord[]> {
    return [...this.accounts.values()].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  public async create(input: NewStaffAccountInput, now: Date): Promise<StaffAccountRecord> {
    if (this.accounts.has(input.userId)) throw new ConflictError("This user already has a staff account.");
    const account: StaffAccountRecord = {
      ...input,
      permissions: [...input.permissions],
      ipAllowList: [...input.ipAllowList],
      status: "active",
      totpSecretEncrypted: null,
      pendingTotpSecretEncrypted: null,
      totpEnabledAt: null,
      totpLastUsedStep: null,
      recoveryCodeHashes: [],
      disabledAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.set(input.userId, account);
    return account;
  }

  public async update(userId: string, changes: StaffAccountChanges, now: Date): Promise<StaffAccountRecord | undefined> {
    const account = this.accounts.get(userId);
    if (account === undefined) return undefined;
    const updated: StaffAccountRecord = { ...account, ...changes, updatedAt: now };
    this.accounts.set(userId, updated);
    return updated;
  }
}

export class InMemoryStaffSecurityRepository implements StaffSecurityRepository {
  private readonly challenges = new Map<string, StaffLoginChallengeRecord>();
  private readonly sessions = new Map<string, StaffSessionRecord>();
  private readonly credentials = new Map<string, WebAuthnCredentialRecord>();

  public async createLoginChallenge(userId: string, tokenHash: string, expiresAt: Date, now: Date): Promise<StaffLoginChallengeRecord> {
    const challenge: StaffLoginChallengeRecord = { id: randomUUID(), userId, tokenHash, attempts: 0, expiresAt, consumedAt: null, createdAt: now };
    this.challenges.set(challenge.id, challenge);
    return challenge;
  }

  public async findUsableLoginChallenge(tokenHash: string, now: Date): Promise<StaffLoginChallengeRecord | undefined> {
    return [...this.challenges.values()].find((challenge) => challenge.tokenHash === tokenHash && challenge.consumedAt === null && challenge.expiresAt > now);
  }

  public async countFailedLoginChallengeAttempt(id: string): Promise<number> {
    const challenge = this.challenges.get(id);
    if (challenge === undefined) return Number.MAX_SAFE_INTEGER;
    this.challenges.set(id, { ...challenge, attempts: challenge.attempts + 1 });
    return challenge.attempts + 1;
  }

  public async consumeLoginChallenge(id: string, now: Date): Promise<boolean> {
    const challenge = this.challenges.get(id);
    if (challenge === undefined || challenge.consumedAt !== null) return false;
    this.challenges.set(id, { ...challenge, consumedAt: now });
    return true;
  }

  public async createStaffSession(session: StaffSessionRecord): Promise<void> {
    this.sessions.set(session.sessionId, session);
  }

  public async findStaffSession(sessionId: string): Promise<StaffSessionRecord | undefined> {
    return this.sessions.get(sessionId);
  }

  public async markStaffSessionSteppedUp(sessionId: string, at: Date): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session !== undefined) this.sessions.set(sessionId, { ...session, stepUpVerifiedAt: at });
  }

  public async listWebAuthnCredentials(userId: string): Promise<readonly WebAuthnCredentialRecord[]> {
    return [...this.credentials.values()].filter((credential) => credential.userId === userId);
  }

  public async addWebAuthnCredential(input: NewWebAuthnCredentialInput, now: Date): Promise<WebAuthnCredentialRecord> {
    const credential: WebAuthnCredentialRecord = { ...input, id: randomUUID(), createdAt: now, lastUsedAt: null };
    this.credentials.set(credential.id, credential);
    return credential;
  }

  public async removeWebAuthnCredential(userId: string, id: string): Promise<boolean> {
    const credential = this.credentials.get(id);
    if (credential === undefined || credential.userId !== userId) return false;
    return this.credentials.delete(id);
  }
}
