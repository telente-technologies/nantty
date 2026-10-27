import type { HttpRequestContext } from "@nantty/fastify-platform";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

import { staffAccessAudience, staffStepUpAudience } from "../constants/delivery.constant.js";
import { ApiError, forbiddenError, unauthorizedError } from "../errors/notifications.error.js";

export interface StaffPrincipal {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly permissions: readonly string[];
  readonly steppedUp: boolean;
}

export class StaffAuthenticator {
  private readonly keySet: JWTVerifyGetKey;

  public constructor(private readonly options: { readonly jwksUrl: string; readonly issuer: string }, keySet?: JWTVerifyGetKey) {
    this.keySet = keySet ?? createRemoteJWKSet(new URL(options.jwksUrl), { cooldownDuration: 30_000, cacheMaxAge: 15 * 60_000 });
  }

  public async authenticate(request: HttpRequestContext): Promise<StaffPrincipal> {
    const token = request.getHeader("authorization")?.replace(/^Bearer\s+/i, "");
    if (token === undefined || token === "") throw unauthorizedError();
    const claims = await this.verify(token, staffAccessAudience);
    const roles = Array.isArray(claims["roles"]) ? (claims["roles"] as unknown[]).filter((role): role is string => typeof role === "string") : [];
    const id = String(claims["sub"] ?? "");
    const stepUpToken = request.getHeader("x-step-up-token");
    const steppedUp = stepUpToken !== undefined && stepUpToken !== "" && (await this.verify(stepUpToken, staffStepUpAudience).then((stepUp) => stepUp["sub"] === id, () => false));
    return {
      id,
      name: roles.find((role) => role.startsWith("name:"))?.slice(5) ?? "Staff",
      role: roles.find((role) => !role.startsWith("name:") && !role.startsWith("perm:")) ?? "",
      permissions: roles.filter((role) => role.startsWith("perm:")).map((role) => role.slice(5)),
      steppedUp,
    };
  }

  private async verify(token: string, audience: string): Promise<Record<string, unknown>> {
    try {
      const { payload } = await jwtVerify(token, this.keySet, { issuer: this.options.issuer, audience, algorithms: ["EdDSA"], clockTolerance: 30, requiredClaims: ["sub", "exp"] });
      return payload as Record<string, unknown>;
    } catch {
      throw unauthorizedError();
    }
  }
}

export function requireAnyPermission(staff: StaffPrincipal, permissions: readonly string[]): void {
  if (staff.role === "superadmin") return;
  if (!permissions.some((permission) => staff.permissions.includes(permission))) throw forbiddenError();
}

export function requireStepUp(staff: StaffPrincipal): void {
  if (!staff.steppedUp) throw new ApiError(403, "STEP_UP_REQUIRED", "Confirm your identity to continue.");
}
