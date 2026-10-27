import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

import { readAgeBracketClaim, type AccessTokenVerifierOptions, type VerifiedPrincipal } from "./accessTokenVerifier.service.js";
import type { ValkeyConnection } from "./valkeyConnection.service.js";

export const widgetTokenAudience = "nantty-widgets";
export const widgetTokenScope = "widgets:read";

export interface WidgetTokenRevocationSource {
  isWidgetTokenCurrent(sessionId: string, tokenId: string): Promise<boolean>;
}

export class ValkeyWidgetTokenRevocationSource implements WidgetTokenRevocationSource {
  public constructor(private readonly connection: ValkeyConnection) {}

  public async isWidgetTokenCurrent(sessionId: string, tokenId: string): Promise<boolean> {
    const [revoked, current] = await Promise.all([
      this.connection.command(["EXISTS", `auth:revoked-session:${sessionId}`]),
      this.connection.command(["GET", `auth:widget-token:${sessionId}`]),
    ]);
    if (revoked instanceof Error || current instanceof Error) throw revoked instanceof Error ? revoked : current;
    return revoked === 0 && current === tokenId;
  }
}

export class WidgetTokenVerifier {
  private readonly keySet: JWTVerifyGetKey;

  public constructor(private readonly options: AccessTokenVerifierOptions, private readonly revocations: WidgetTokenRevocationSource | undefined, keySet?: JWTVerifyGetKey) {
    this.keySet = keySet ?? createRemoteJWKSet(new URL(options.jwksUrl), { cooldownDuration: 30_000, cacheMaxAge: 15 * 60_000 });
  }

  public async verifyWidgetToken(token: string): Promise<VerifiedPrincipal | undefined> {
    try {
      const { payload } = await jwtVerify(token, this.keySet, {
        issuer: this.options.issuer,
        audience: widgetTokenAudience,
        algorithms: ["EdDSA"],
        clockTolerance: 30,
        requiredClaims: ["sub", "sid", "jti", "exp", "scope"],
      });
      if (typeof payload.sub !== "string" || typeof payload.sid !== "string" || typeof payload.jti !== "string" || payload["scope"] !== widgetTokenScope) return undefined;
      if (this.revocations !== undefined && !(await this.revocations.isWidgetTokenCurrent(payload.sid, payload.jti))) return undefined;
      return { accountId: payload.sub, sessionId: payload.sid, roles: [], ageBracket: readAgeBracketClaim(payload["age"]), scope: "widgets" };
    } catch {
      return undefined;
    }
  }
}
