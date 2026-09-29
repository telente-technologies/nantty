import { ForbiddenError, UnauthorizedError } from "@zudojs/errors";
import type { HttpMiddleware, RouteOptions } from "@zudojs/http";

import { rolesGrantPermission, type Permission } from "../constants/permissions.constant.js";
import type { AccessTokenVerifier } from "../interfaces/index.js";
import { authenticateBearerToken } from "./authenticate.middleware.js";

export const PUBLIC_ROUTE = "public";

export interface RouteGuard {
  requirePermission(permission: Permission, ...extra: readonly HttpMiddleware[]): RouteOptions;
  requireSignedInUser(...extra: readonly HttpMiddleware[]): RouteOptions;
  allowAnyone(...extra: readonly HttpMiddleware[]): RouteOptions;
}

export function createRouteGuard(verifier: AccessTokenVerifier, resolveViewerLocale: HttpMiddleware): RouteGuard {
  const createPermissionCheckMiddleware = (permission: Permission | undefined): HttpMiddleware =>
    async (context, next) => {
      const principal = await authenticateBearerToken(context, verifier);
      if (principal === undefined) throw new UnauthorizedError("Authentication required.");
      if (permission !== undefined && !rolesGrantPermission(principal.roles, permission)) {
        throw new ForbiddenError("You do not have permission to do this.");
      }
      return next();
    };

  const attachPrincipalWhenPresent: HttpMiddleware = async (context, next) => {
    try {
      await authenticateBearerToken(context, verifier);
    } catch {
      context.state.delete("principal");
    }
    return next();
  };

  return {
    requirePermission: (permission, ...extra) => ({
      middleware: [createPermissionCheckMiddleware(permission), resolveViewerLocale, ...extra],
      metadata: { permission },
    }),
    requireSignedInUser: (...extra) => ({
      middleware: [createPermissionCheckMiddleware(undefined), resolveViewerLocale, ...extra],
      metadata: { permission: "authenticated" },
    }),
    allowAnyone: (...extra) => ({ middleware: [attachPrincipalWhenPresent, resolveViewerLocale, ...extra], metadata: { permission: PUBLIC_ROUTE } }),
  };
}
