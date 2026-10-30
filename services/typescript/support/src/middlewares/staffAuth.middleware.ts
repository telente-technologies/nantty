import type { HttpRouterContext } from "@nantty/fastify-platform";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

import { staffAccessAudience } from "../constants/support.constant.js";
import { forbidden, unauthorized } from "../errors/support.error.js";

export interface StaffPrincipal {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly permissions: readonly string[];
}

export interface StaffAuthenticator {
  authenticate(context: HttpRouterContext): Promise<StaffPrincipal>;
}

export function createJwtStaffAuthenticator(options: { readonly jwksUrl: string; readonly issuer: string }, keySet?: JWTVerifyGetKey): StaffAuthenticator {
  const keys = keySet ?? createRemoteJWKSet(new URL(options.jwksUrl), { cooldownDuration: 30_000, cacheMaxAge: 15 * 60_000 });
  return {
    async authenticate(context) {
      const token = context.request.getHeader("authorization")?.replace(/^Bearer\s+/i, "");
      if (token === undefined || token === "") throw unauthorized();
      let claims: Record<string, unknown>;
      try {
        ({ payload: claims } = await jwtVerify(token, keys, { issuer: options.issuer, audience: staffAccessAudience, algorithms: ["EdDSA"], clockTolerance: 30, requiredClaims: ["sub", "exp"] }));
      } catch {
        throw unauthorized();
      }
      const roles = Array.isArray(claims["roles"]) ? (claims["roles"] as unknown[]).filter((role): role is string => typeof role === "string") : [];
      return {
        id: String(claims["sub"] ?? ""),
        name: roles.find((role) => role.startsWith("name:"))?.slice(5) ?? "Nantty Support",
        role: roles.find((role) => !role.startsWith("name:") && !role.startsWith("perm:")) ?? "",
        permissions: roles.filter((role) => role.startsWith("perm:")).map((role) => role.slice(5)),
      };
    },
  };
}

export const unavailableStaffAuthenticator: StaffAuthenticator = {
  authenticate: async () => {
    throw unauthorized();
  },
};

export function staffHoldsAnyPermission(staff: StaffPrincipal, permissions: readonly string[]): boolean {
  return staff.role === "superadmin" || permissions.some((permission) => staff.permissions.includes(permission));
}

export function requireAnyStaffPermission(staff: StaffPrincipal, permissions: readonly string[]): void {
  if (!staffHoldsAnyPermission(staff, permissions)) throw forbidden();
}
