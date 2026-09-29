import { ForbiddenError, UnauthorizedError } from "@zudojs/errors";
import type { HttpMiddleware, RouteOptions } from "@zudojs/http";

import { isPlatformPermission, rolesGrantPermission, type Permission } from "../constants/permissions.constant.js";
import type { AccessTokenVerifier } from "../interfaces/index.js";
import type { PlatformStaffAccessCheck, StaffRouteRequirement } from "../interfaces/platformStaffAccess.interface.js";
import { authenticateBearerToken } from "./authenticate.middleware.js";

export const PUBLIC_ROUTE = "public";
export const PLATFORM_STAFF_ROUTE = "platform-staff";

export interface RouteGuard {
  requirePermission(permission: Permission, ...extra: readonly HttpMiddleware[]): RouteOptions;
  requireAnyPermission(permissions: readonly Permission[], ...extra: readonly HttpMiddleware[]): RouteOptions;
  requireStepUpPermission(permission: Permission | readonly Permission[], ...extra: readonly HttpMiddleware[]): RouteOptions;
  requirePlatformStaff(...extra: readonly HttpMiddleware[]): RouteOptions;
  requireSignedInUser(...extra: readonly HttpMiddleware[]): RouteOptions;
  allowAnyone(...extra: readonly HttpMiddleware[]): RouteOptions;
}

export function createRouteGuard(
  verifier: AccessTokenVerifier,
  resolveViewerLocale: HttpMiddleware,
  staffAccess?: PlatformStaffAccessCheck,
): RouteGuard {
  const createStaffMiddleware = (requirement: StaffRouteRequirement): HttpMiddleware =>
    async (context, next) => {
      if (staffAccess === undefined) throw new ForbiddenError("You do not have permission to do this.");
      return staffAccess.handleStaffRequest(context, requirement, next);
    };

  const createPermissionCheckMiddleware = (permission: Permission | undefined): HttpMiddleware => {
    if (permission !== undefined && isPlatformPermission(permission)) return createStaffMiddleware({ anyOfPermissions: [permission], requireStepUp: false });
    return async (context, next) => {
      const principal = await authenticateBearerToken(context, verifier);
      if (principal === undefined) throw new UnauthorizedError("Authentication required.");
      if (permission !== undefined && !rolesGrantPermission(principal.roles, permission)) {
        throw new ForbiddenError("You do not have permission to do this.");
      }
      return next();
    };
  };

  const attachPrincipalWhenPresent: HttpMiddleware = async (context, next) => {
    try {
      await authenticateBearerToken(context, verifier);
    } catch {
      context.state.delete("principal");
    }
    return next();
  };

  const describePermissions = (permissions: readonly Permission[]): string => permissions.join("|");

  return {
    requirePermission: (permission, ...extra) => ({
      middleware: [createPermissionCheckMiddleware(permission), resolveViewerLocale, ...extra],
      metadata: { permission },
    }),
    requireAnyPermission: (permissions, ...extra) => ({
      middleware: [createStaffMiddleware({ anyOfPermissions: permissions, requireStepUp: false }), resolveViewerLocale, ...extra],
      metadata: { permission: describePermissions(permissions) },
    }),
    requireStepUpPermission: (permission, ...extra) => {
      const permissions: readonly Permission[] = typeof permission === "string" ? [permission] : permission;
      return {
        middleware: [createStaffMiddleware({ anyOfPermissions: permissions, requireStepUp: true }), resolveViewerLocale, ...extra],
        metadata: { permission: describePermissions(permissions), stepUp: true },
      };
    },
    requirePlatformStaff: (...extra) => ({
      middleware: [createStaffMiddleware({ anyOfPermissions: [], requireStepUp: false }), resolveViewerLocale, ...extra],
      metadata: { permission: PLATFORM_STAFF_ROUTE },
    }),
    requireSignedInUser: (...extra) => ({
      middleware: [createPermissionCheckMiddleware(undefined), resolveViewerLocale, ...extra],
      metadata: { permission: "authenticated" },
    }),
    allowAnyone: (...extra) => ({ middleware: [attachPrincipalWhenPresent, resolveViewerLocale, ...extra], metadata: { permission: PUBLIC_ROUTE } }),
  };
}
