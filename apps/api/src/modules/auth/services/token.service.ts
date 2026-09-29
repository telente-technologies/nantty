import { randomUUID } from "node:crypto";

import { createTokenPair, verifyAccessToken, verifyRefreshToken, type TokenConfig } from "@zudojs/auth";
import { UnauthorizedError } from "@zudojs/errors";

import type { AppSettings } from "../../../configs/settings.config.js";
import { describePlatformPermissionAsRole } from "../../../constants/permissions.constant.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { PlatformPermissionGrants } from "../../../interfaces/platformStaffAccess.interface.js";
import type { AccessTokenVerifier, Principal } from "../../../interfaces/principal.interface.js";
import { hashesAreEqual, hashSecretWithKey } from "../../../utils/hashToken.util.js";
import type { UserRecord } from "../../users/models/users.model.js";
import type { UsersRepository } from "../../users/repositories/users.repository.js";
import type { ClientDetails, IssuedTokens, SessionRecord } from "../models/auth.model.js";
import type { SessionsRepository } from "../repositories/auth.repository.js";

type TokenSubject = Parameters<typeof createTokenPair>[0];
type TokenSessionId = NonNullable<NonNullable<Parameters<typeof createTokenPair>[2]>["sessionId"]>;
type SessionKind = "user" | "admin";

export interface AdminSessionSettings {
  readonly accessTtlSeconds: number;
  readonly sessionTtlSeconds: number;
}

export class TokenService implements AccessTokenVerifier {
  private readonly tokenConfig: TokenConfig;
  private readonly adminTokenConfig: TokenConfig;
  private readonly refreshHashKey: Uint8Array;

  public constructor(
    private readonly settings: AppSettings["auth"],
    private readonly sessions: SessionsRepository,
    private readonly users: UsersRepository,
    private readonly clock: Clock,
    private readonly adminSessions: AdminSessionSettings = { accessTtlSeconds: 300, sessionTtlSeconds: 8 * 3_600 },
    private readonly platformGrants?: PlatformPermissionGrants,
  ) {
    this.tokenConfig = {
      accessSecret: settings.accessSecret,
      refreshSecret: settings.refreshSecret,
      accessTtl: settings.accessTtlSeconds,
      refreshTtl: settings.refreshTtlSeconds,
      issuer: "zudomart-api",
      audience: "zudomart-app",
      clockToleranceSeconds: 5,
      clock: { now: () => clock.now().getTime() },
    };
    this.adminTokenConfig = {
      ...this.tokenConfig,
      accessTtl: adminSessions.accessTtlSeconds,
      refreshTtl: adminSessions.sessionTtlSeconds,
      audience: "zudomart-admin",
    };
    this.refreshHashKey = new TextEncoder().encode(`refresh-token:${settings.refreshSecret}`);
  }

  public startSessionForUser(user: UserRecord, client: ClientDetails): Promise<IssuedTokens> {
    return this.startSession(user, client, "user");
  }

  public startAdminSessionForUser(user: UserRecord, client: ClientDetails): Promise<IssuedTokens> {
    return this.startSession(user, client, "admin");
  }

  private async startSession(user: UserRecord, client: ClientDetails, kind: SessionKind): Promise<IssuedTokens> {
    const sessionId = randomUUID();
    const config = this.findTokenConfigForKind(kind);
    const pair = createTokenPair(user.id as TokenSubject, config, { roles: user.roles, sessionId: sessionId as TokenSessionId });
    await this.sessions.create({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: await this.hashRefreshTokenForStorage(pair.refreshToken),
      userAgent: client.userAgent,
      ip: client.ip,
      expiresAt: new Date(this.clock.now().getTime() + (kind === "admin" ? this.adminSessions.sessionTtlSeconds : this.settings.refreshTtlSeconds) * 1000),
    });
    return { accessToken: pair.accessToken, refreshToken: pair.refreshToken, expiresIn: pair.expiresIn, tokenType: "Bearer", sessionId };
  }

  public async rotateRefreshToken(refreshToken: string): Promise<IssuedTokens> {
    const verified = this.verifyRefreshTokenOfAnyKind(refreshToken);
    const sessionId = verified?.sessionId;
    if (verified === undefined || sessionId === undefined) throw new UnauthorizedError("Invalid refresh token.");
    const session = await this.findUsableSession(sessionId);
    const presentedHash = await this.hashRefreshTokenForStorage(refreshToken);
    if (!hashesAreEqual(presentedHash, session.refreshTokenHash)) {
      await this.revokeSessionAfterRefreshTokenReuse(session.id);
    }
    const user = await this.users.findById(session.userId);
    if (user === undefined || user.status !== "active") {
      await this.sessions.revoke(session.id, "account_inactive", this.clock.now());
      throw new UnauthorizedError("Invalid refresh token.");
    }
    const pair = createTokenPair(user.id as TokenSubject, this.findTokenConfigForKind(verified.kind), { roles: user.roles, sessionId: session.id as TokenSessionId });
    const nextHash = await this.hashRefreshTokenForStorage(pair.refreshToken);
    const swapped = await this.sessions.replaceRefreshTokenHash(session.id, presentedHash, nextHash, this.clock.now());
    if (!swapped) await this.revokeSessionAfterRefreshTokenReuse(session.id);
    return { accessToken: pair.accessToken, refreshToken: pair.refreshToken, expiresIn: pair.expiresIn, tokenType: "Bearer", sessionId: session.id };
  }

  public findSessionIdInRefreshToken(refreshToken: string): string | undefined {
    return this.verifyRefreshTokenOfAnyKind(refreshToken)?.sessionId;
  }

  public async verify(accessToken: string): Promise<Principal> {
    const userVerification = verifyAccessToken(accessToken, this.tokenConfig);
    const kind: SessionKind = userVerification.valid ? "user" : "admin";
    const verification = userVerification.valid ? userVerification : verifyAccessToken(accessToken, this.adminTokenConfig);
    const payload = verification.valid ? verification.payload : undefined;
    if (payload?.sid === undefined) throw new UnauthorizedError("Invalid or expired access token.");
    await this.findUsableSession(payload.sid);
    const roles = payload.roles ?? [];
    if (kind === "user") return { userId: payload.sub, roles, sessionId: payload.sid, sessionKind: kind };
    const grants = (await this.platformGrants?.findGrantedPlatformPermissions(payload.sub)) ?? [];
    return { userId: payload.sub, roles: [...roles, ...grants.map(describePlatformPermissionAsRole)], sessionId: payload.sid, sessionKind: kind };
  }

  private findTokenConfigForKind(kind: SessionKind): TokenConfig {
    return kind === "admin" ? this.adminTokenConfig : this.tokenConfig;
  }

  private verifyRefreshTokenOfAnyKind(refreshToken: string): { readonly kind: SessionKind; readonly sessionId: string | undefined } | undefined {
    for (const kind of ["user", "admin"] as const) {
      const verification = verifyRefreshToken(refreshToken, this.findTokenConfigForKind(kind));
      if (verification.valid) return { kind, sessionId: verification.payload?.sid };
    }
    return undefined;
  }

  private async findUsableSession(sessionId: string): Promise<SessionRecord> {
    const session = await this.sessions.findById(sessionId);
    if (session === undefined || session.revokedAt !== null || session.expiresAt <= this.clock.now()) {
      throw new UnauthorizedError("Your session has ended. Sign in again.");
    }
    return session;
  }

  private async revokeSessionAfterRefreshTokenReuse(sessionId: string): Promise<never> {
    await this.sessions.revoke(sessionId, "refresh_token_reuse", this.clock.now());
    throw new UnauthorizedError("This refresh token was already used. The session has been signed out.");
  }

  private hashRefreshTokenForStorage(refreshToken: string): Promise<string> {
    return hashSecretWithKey(refreshToken, this.refreshHashKey);
  }
}
