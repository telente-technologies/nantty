import { randomUUID } from "node:crypto";

import { createTokenPair, verifyAccessToken, verifyRefreshToken, type TokenConfig } from "@zudojs/auth";

import type { AppSettings } from "../../../configs/settings.config.js";
import { describePlatformPermissionAsRole } from "../../../constants/permissions.constant.js";
import { listEffectivePlatformPermissions } from "../../../constants/platformRoles.constant.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { AccessTokenVerifier, Principal } from "../../../interfaces/principal.interface.js";
import { adminError } from "../../../utils/adminHttp.util.js";
import { hashesAreEqual, hashSecretWithKey } from "../../../utils/hashToken.util.js";
import type { StaffAccountRecord, StaffSessionRecord } from "../models/platformStaff.model.js";
import type { StaffAccountsRepository } from "../repositories/staffAccounts.repository.js";
import type { StaffSecurityRepository } from "../repositories/staffSecurity.repository.js";

type TokenSubject = Parameters<typeof createTokenPair>[0];
type TokenSessionId = NonNullable<NonNullable<Parameters<typeof createTokenPair>[2]>["sessionId"]>;

export const ADMIN_TOKEN_AUDIENCE = "zudomart-admin";

export interface IssuedAdminTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly tokenType: "Bearer";
  readonly sessionId: string;
}

export interface StaffClient {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

function invalidRefreshToken(): Error {
  return adminError(401, "INVALID_REFRESH_TOKEN", "Your session has ended. Sign in again.");
}

export class AdminTokenService implements AccessTokenVerifier {
  private readonly tokenConfig: TokenConfig;
  private readonly refreshHashKey: Uint8Array;

  public constructor(
    private readonly authSettings: AppSettings["auth"],
    private readonly adminSettings: AppSettings["platformAdmin"],
    private readonly accounts: StaffAccountsRepository,
    private readonly security: StaffSecurityRepository,
    private readonly clock: Clock,
  ) {
    this.tokenConfig = {
      accessSecret: authSettings.accessSecret,
      refreshSecret: authSettings.refreshSecret,
      accessTtl: adminSettings.accessTtlSeconds,
      refreshTtl: adminSettings.sessionTtlSeconds,
      issuer: "zudomart-api",
      audience: ADMIN_TOKEN_AUDIENCE,
      clockToleranceSeconds: 5,
      clock: { now: () => clock.now().getTime() },
    };
    this.refreshHashKey = new TextEncoder().encode(`admin-refresh-token:${authSettings.refreshSecret}`);
  }

  public async startSession(account: StaffAccountRecord, client: StaffClient): Promise<IssuedAdminTokens> {
    const sessionId = randomUUID();
    const pair = createTokenPair(account.id as TokenSubject, this.tokenConfig, { roles: [account.role], sessionId: sessionId as TokenSessionId });
    const now = this.clock.now();
    await this.security.createSession({
      id: sessionId,
      staffId: account.id,
      refreshTokenHash: await this.hashRefreshToken(pair.refreshToken),
      ipAddress: client.ipAddress,
      userAgent: client.userAgent,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.adminSettings.sessionTtlSeconds * 1000),
    });
    return { accessToken: pair.accessToken, refreshToken: pair.refreshToken, expiresIn: pair.expiresIn, tokenType: "Bearer", sessionId };
  }

  public async rotateRefreshToken(refreshToken: string): Promise<IssuedAdminTokens> {
    const verification = verifyRefreshToken(refreshToken, this.tokenConfig);
    const sessionId = verification.valid ? verification.payload?.sid : undefined;
    if (sessionId === undefined) throw invalidRefreshToken();
    const session = await this.findUsableSession(sessionId);
    if (session === undefined) throw invalidRefreshToken();
    const presentedHash = await this.hashRefreshToken(refreshToken);
    if (!hashesAreEqual(presentedHash, session.refreshTokenHash)) await this.revokeAfterReuse(session.id);
    const account = await this.accounts.findById(session.staffId);
    if (account === undefined || account.status !== "ACTIVE") {
      await this.security.revokeSession(session.id, "account_inactive", this.clock.now());
      throw invalidRefreshToken();
    }
    const pair = createTokenPair(account.id as TokenSubject, this.tokenConfig, { roles: [account.role], sessionId: session.id as TokenSessionId });
    const remainingSeconds = Math.max(1, Math.floor((session.expiresAt.getTime() - this.clock.now().getTime()) / 1000));
    const swapped = await this.security.replaceRefreshTokenHash(session.id, presentedHash, await this.hashRefreshToken(pair.refreshToken), this.clock.now());
    if (!swapped) await this.revokeAfterReuse(session.id);
    return { accessToken: pair.accessToken, refreshToken: pair.refreshToken, expiresIn: Math.min(pair.expiresIn, remainingSeconds), tokenType: "Bearer", sessionId: session.id };
  }

  public findSessionIdInRefreshToken(refreshToken: string): string | undefined {
    const verification = verifyRefreshToken(refreshToken, this.tokenConfig);
    return verification.valid ? verification.payload?.sid : undefined;
  }

  public async verify(accessToken: string): Promise<Principal> {
    const verification = verifyAccessToken(accessToken, this.tokenConfig);
    const payload = verification.valid ? verification.payload : undefined;
    if (payload?.sid === undefined) throw adminError(401, "INVALID_TOKEN", "Invalid or expired admin session.");
    const session = await this.findUsableSession(payload.sid);
    if (session === undefined || session.staffId !== payload.sub) throw adminError(401, "SESSION_ENDED", "Your admin session has ended. Sign in again.");
    const account = await this.accounts.findById(session.staffId);
    if (account === undefined || account.status !== "ACTIVE") throw adminError(403, "ACCOUNT_DISABLED", "This admin account is disabled.");
    const grants = listEffectivePlatformPermissions(account.role, account.permissions).map(describePlatformPermissionAsRole);
    return { userId: account.id, roles: grants, sessionId: session.id, sessionKind: "admin" };
  }

  public async findUsableSession(sessionId: string): Promise<StaffSessionRecord | undefined> {
    const session = await this.security.findSession(sessionId);
    if (session === undefined || session.revokedAt !== null || session.expiresAt <= this.clock.now()) return undefined;
    return session;
  }

  private async revokeAfterReuse(sessionId: string): Promise<never> {
    await this.security.revokeSession(sessionId, "refresh_token_reuse", this.clock.now());
    throw adminError(401, "REFRESH_TOKEN_REUSED", "This refresh token was already used. The session has been signed out.");
  }

  private hashRefreshToken(refreshToken: string): Promise<string> {
    return hashSecretWithKey(refreshToken, this.refreshHashKey);
  }
}

export class CombinedAccessTokenVerifier implements AccessTokenVerifier {
  public constructor(private readonly userTokens: AccessTokenVerifier, private readonly adminTokens: AccessTokenVerifier) {}

  public async verify(accessToken: string): Promise<Principal> {
    try {
      return await this.userTokens.verify(accessToken);
    } catch (userTokenError) {
      try {
        return await this.adminTokens.verify(accessToken);
      } catch (adminTokenError) {
        const code = (adminTokenError as { readonly code?: unknown }).code;
        throw code === "INVALID_TOKEN" ? userTokenError : adminTokenError;
      }
    }
  }
}
