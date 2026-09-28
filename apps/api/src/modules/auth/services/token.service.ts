import { randomUUID } from "node:crypto";

import { createTokenPair, verifyAccessToken, verifyRefreshToken, type TokenConfig } from "@zudojs/auth";
import { UnauthorizedError } from "@zudojs/errors";

import type { AppSettings } from "../../../configs/settings.config.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { AccessTokenVerifier, Principal } from "../../../interfaces/principal.interface.js";
import { hashesAreEqual, hashSecretWithKey } from "../../../utils/hashToken.util.js";
import type { UserRecord } from "../../users/models/users.model.js";
import type { UsersRepository } from "../../users/repositories/users.repository.js";
import type { ClientDetails, IssuedTokens, SessionRecord } from "../models/auth.model.js";
import type { SessionsRepository } from "../repositories/auth.repository.js";

type TokenSubject = Parameters<typeof createTokenPair>[0];
type TokenSessionId = NonNullable<NonNullable<Parameters<typeof createTokenPair>[2]>["sessionId"]>;

export class TokenService implements AccessTokenVerifier {
  private readonly tokenConfig: TokenConfig;
  private readonly refreshHashKey: Uint8Array;

  public constructor(
    private readonly settings: AppSettings["auth"],
    private readonly sessions: SessionsRepository,
    private readonly users: UsersRepository,
    private readonly clock: Clock,
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
    this.refreshHashKey = new TextEncoder().encode(`refresh-token:${settings.refreshSecret}`);
  }

  public async startSessionForUser(user: UserRecord, client: ClientDetails): Promise<IssuedTokens> {
    const sessionId = randomUUID();
    const pair = createTokenPair(user.id as TokenSubject, this.tokenConfig, { roles: user.roles, sessionId: sessionId as TokenSessionId });
    await this.sessions.create({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: await this.hashRefreshTokenForStorage(pair.refreshToken),
      userAgent: client.userAgent,
      ip: client.ip,
      expiresAt: new Date(this.clock.now().getTime() + this.settings.refreshTtlSeconds * 1000),
    });
    return { accessToken: pair.accessToken, refreshToken: pair.refreshToken, expiresIn: pair.expiresIn, tokenType: "Bearer", sessionId };
  }

  public async rotateRefreshToken(refreshToken: string): Promise<IssuedTokens> {
    const verification = verifyRefreshToken(refreshToken, this.tokenConfig);
    const sessionId = verification.valid ? verification.payload?.sid : undefined;
    if (sessionId === undefined) throw new UnauthorizedError("Invalid refresh token.");
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
    const pair = createTokenPair(user.id as TokenSubject, this.tokenConfig, { roles: user.roles, sessionId: session.id as TokenSessionId });
    const nextHash = await this.hashRefreshTokenForStorage(pair.refreshToken);
    const swapped = await this.sessions.replaceRefreshTokenHash(session.id, presentedHash, nextHash, this.clock.now());
    if (!swapped) await this.revokeSessionAfterRefreshTokenReuse(session.id);
    return { accessToken: pair.accessToken, refreshToken: pair.refreshToken, expiresIn: pair.expiresIn, tokenType: "Bearer", sessionId: session.id };
  }

  public async verify(accessToken: string): Promise<Principal> {
    const verification = verifyAccessToken(accessToken, this.tokenConfig);
    const payload = verification.valid ? verification.payload : undefined;
    if (payload?.sid === undefined) throw new UnauthorizedError("Invalid or expired access token.");
    await this.findUsableSession(payload.sid);
    return { userId: payload.sub, roles: payload.roles ?? [], sessionId: payload.sid };
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
