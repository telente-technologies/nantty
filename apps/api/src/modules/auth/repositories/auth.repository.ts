import { randomUUID } from "node:crypto";

import type { NewSessionInput, OtpPurpose, OtpRecord, SessionRecord, SocialProvider } from "../models/auth.model.js";

export interface SessionsRepository {
  create(input: NewSessionInput): Promise<SessionRecord>;
  findById(id: string): Promise<SessionRecord | undefined>;
  replaceRefreshTokenHash(id: string, expectedHash: string, nextHash: string, usedAt: Date): Promise<boolean>;
  revoke(id: string, reason: string, revokedAt: Date): Promise<void>;
  revokeAllForUser(userId: string, reason: string, revokedAt: Date): Promise<void>;
  listActiveForUser(userId: string, now: Date): Promise<readonly SessionRecord[]>;
}

export interface OneTimeCodesRepository {
  replaceActiveCode(target: string, purpose: OtpPurpose, codeHash: string, expiresAt: Date, now: Date): Promise<OtpRecord>;
  findLatestActiveCode(target: string, purpose: OtpPurpose, now: Date): Promise<OtpRecord | undefined>;
  findLatestCode(target: string, purpose: OtpPurpose): Promise<OtpRecord | undefined>;
  incrementFailedAttempts(id: string): Promise<number>;
  consumeCode(id: string, consumedAt: Date): Promise<boolean>;
}

export interface SocialIdentitiesRepository {
  findUserIdForIdentity(provider: SocialProvider, subject: string): Promise<string | undefined>;
  linkIdentity(userId: string, provider: SocialProvider, subject: string): Promise<void>;
}

export class InMemorySessionsRepository implements SessionsRepository {
  private readonly sessions = new Map<string, SessionRecord>();

  public async create(input: NewSessionInput): Promise<SessionRecord> {
    const now = new Date();
    const session: SessionRecord = { ...input, createdAt: now, lastUsedAt: now, revokedAt: null, revokedReason: null };
    this.sessions.set(session.id, session);
    return session;
  }

  public async findById(id: string): Promise<SessionRecord | undefined> {
    return this.sessions.get(id);
  }

  public async replaceRefreshTokenHash(id: string, expectedHash: string, nextHash: string, usedAt: Date): Promise<boolean> {
    const session = this.sessions.get(id);
    if (session === undefined || session.revokedAt !== null || session.refreshTokenHash !== expectedHash) return false;
    this.sessions.set(id, { ...session, refreshTokenHash: nextHash, lastUsedAt: usedAt });
    return true;
  }

  public async revoke(id: string, reason: string, revokedAt: Date): Promise<void> {
    const session = this.sessions.get(id);
    if (session !== undefined && session.revokedAt === null) {
      this.sessions.set(id, { ...session, revokedAt, revokedReason: reason });
    }
  }

  public async revokeAllForUser(userId: string, reason: string, revokedAt: Date): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) await this.revoke(session.id, reason, revokedAt);
    }
  }

  public async listActiveForUser(userId: string, now: Date): Promise<readonly SessionRecord[]> {
    return [...this.sessions.values()].filter(
      (session) => session.userId === userId && session.revokedAt === null && session.expiresAt > now,
    );
  }
}

export class InMemoryOneTimeCodesRepository implements OneTimeCodesRepository {
  private readonly codes = new Map<string, OtpRecord>();

  public async replaceActiveCode(target: string, purpose: OtpPurpose, codeHash: string, expiresAt: Date, now: Date): Promise<OtpRecord> {
    for (const code of this.codes.values()) {
      if (code.target === target && code.purpose === purpose && code.consumedAt === null) {
        this.codes.set(code.id, { ...code, consumedAt: now });
      }
    }
    const record: OtpRecord = { id: randomUUID(), target, purpose, codeHash, attempts: 0, expiresAt, consumedAt: null, createdAt: now };
    this.codes.set(record.id, record);
    return record;
  }

  public async findLatestActiveCode(target: string, purpose: OtpPurpose, now: Date): Promise<OtpRecord | undefined> {
    const latest = await this.findLatestCode(target, purpose);
    return latest !== undefined && latest.consumedAt === null && latest.expiresAt > now ? latest : undefined;
  }

  public async findLatestCode(target: string, purpose: OtpPurpose): Promise<OtpRecord | undefined> {
    return [...this.codes.values()]
      .filter((code) => code.target === target && code.purpose === purpose)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
  }

  public async incrementFailedAttempts(id: string): Promise<number> {
    const code = this.codes.get(id);
    if (code === undefined) return Number.MAX_SAFE_INTEGER;
    this.codes.set(id, { ...code, attempts: code.attempts + 1 });
    return code.attempts + 1;
  }

  public async consumeCode(id: string, consumedAt: Date): Promise<boolean> {
    const code = this.codes.get(id);
    if (code === undefined || code.consumedAt !== null) return false;
    this.codes.set(id, { ...code, consumedAt });
    return true;
  }
}

export class InMemorySocialIdentitiesRepository implements SocialIdentitiesRepository {
  private readonly identities = new Map<string, string>();

  public async findUserIdForIdentity(provider: SocialProvider, subject: string): Promise<string | undefined> {
    return this.identities.get(`${provider}:${subject}`);
  }

  public async linkIdentity(userId: string, provider: SocialProvider, subject: string): Promise<void> {
    this.identities.set(`${provider}:${subject}`, userId);
  }
}
