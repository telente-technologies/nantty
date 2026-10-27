import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

import type { ValkeyConnection } from "./valkeyConnection.service.js";

export interface VerifiedPrincipal {
  readonly accountId: string;
  readonly sessionId: string;
  readonly roles: readonly string[];
  readonly ageBracket?: "adult" | "minor" | "unknown";
  readonly scope?: "widgets";
}

export function readAgeBracketClaim(value: unknown): "adult" | "minor" | "unknown" {
  return value === "adult" || value === "minor" ? value : "unknown";
}

export interface AccessTokenVerifierOptions {
  readonly jwksUrl: string;
  readonly issuer: string;
  readonly audience: string;
  readonly staffAudience?: string;
}

export interface SessionRevocationSource {
  isSessionRevoked(sessionId: string): Promise<boolean>;
}

export class ValkeySessionRevocationSource implements SessionRevocationSource {
  public constructor(private readonly connection: ValkeyConnection) {}

  public async isSessionRevoked(sessionId: string): Promise<boolean> {
    const revoked = await this.connection.command(["EXISTS", `auth:revoked-session:${sessionId}`]);
    if (revoked instanceof Error) throw revoked;
    return revoked !== 0;
  }
}

export const staffAccessTokenAudience = "nantty-admin";
const hasControlCharacter = (value: string): boolean => [...value].some((character) => character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f);

export class AccessTokenVerifier {
  private readonly keySet: JWTVerifyGetKey;

  public constructor(private readonly options: AccessTokenVerifierOptions, keySet?: JWTVerifyGetKey, private readonly revocations?: SessionRevocationSource) {
    this.keySet = keySet ?? createRemoteJWKSet(new URL(options.jwksUrl), { cooldownDuration: 30_000, cacheMaxAge: 15 * 60_000 });
  }

  public verifyAccessTokenWithJwks(token: string): Promise<VerifiedPrincipal | undefined> {
    return this.verifyForAudience(token, this.options.audience);
  }

  public verifyStaffAccessToken(token: string): Promise<VerifiedPrincipal | undefined> {
    return this.verifyForAudience(token, this.options.staffAudience ?? staffAccessTokenAudience);
  }

  private async verifyForAudience(token: string, audience: string): Promise<VerifiedPrincipal | undefined> {
    try {
      const { payload } = await jwtVerify(token, this.keySet, {
        issuer: this.options.issuer,
        audience,
        algorithms: ["EdDSA"],
        clockTolerance: 30,
        requiredClaims: ["sub", "sid", "exp"],
      });
      if (typeof payload.sub !== "string" || typeof payload.sid !== "string" || payload["scope"] !== undefined) return undefined;
      if (hasControlCharacter(payload.sub) || hasControlCharacter(payload.sid)) return undefined;
      if (this.revocations !== undefined && await this.revocations.isSessionRevoked(payload.sid)) return undefined;
      const roles = Array.isArray(payload.roles) ? payload.roles.filter((role): role is string => typeof role === "string") : [];
      return { accountId: payload.sub, sessionId: payload.sid, roles, ageBracket: readAgeBracketClaim(payload["age"]) };
    } catch {
      return undefined;
    }
  }
}

export function extractBearerTokenFromAuthorizationHeader(header: string | undefined): string | undefined {
  if (header === undefined || !/^Bearer\s+/i.test(header)) return undefined;
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token === "" ? undefined : token;
}
