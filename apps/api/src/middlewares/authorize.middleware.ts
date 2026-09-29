import { ForbiddenError, UnauthorizedError } from "@zudojs/errors";
import type { HttpMiddleware, HttpMiddlewareContext, RouteOptions } from "@zudojs/http";

import { isPlatformPermission, rolesGrantPermission, type Permission } from "../constants/permissions.constant.js";
import type { AccessTokenVerifier, Principal } from "../interfaces/index.js";
import type { PlatformStaffAccessCheck, StaffRequestDetails } from "../interfaces/platformStaffAccess.interface.js";
import { authenticateBearerToken } from "./authenticate.middleware.js";

export const PUBLIC_ROUTE = "public";
export const PLATFORM_STAFF_ROUTE = "platform-staff";

export interface RouteGuard {
  requirePermission(permission: Permission, ...extra: readonly HttpMiddleware[]): RouteOptions;
  requireStepUpPermission(permission: Permission, ...extra: readonly HttpMiddleware[]): RouteOptions;
  requirePlatformStaff(...extra: readonly HttpMiddleware[]): RouteOptions;
  requireSignedInUser(...extra: readonly HttpMiddleware[]): RouteOptions;
  allowAnyone(...extra: readonly HttpMiddleware[]): RouteOptions;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function describeStaffRequest(context: HttpMiddlewareContext): StaffRequestDetails {
  return {
    clientIp: context.request.remoteAddress ?? null,
    method: context.request.method.toUpperCase(),
    path: context.request.path,
  };
}

async function requirePrincipal(context: HttpMiddlewareContext, verifier: AccessTokenVerifier): Promise<Principal> {
  const principal = await authenticateBearerToken(context, verifier);
  if (principal === undefined) throw new UnauthorizedError("Authentication required.");
  return principal;
}

export function createRouteGuard(
  verifier: AccessTokenVerifier,
  resolveViewerLocale: HttpMiddleware,
  staffAccess?: PlatformStaffAccessCheck,
): RouteGuard {
  const requireStaffAccess = (): PlatformStaffAccessCheck => {
    if (staffAccess === undefined) throw new ForbiddenError("You do not have permission to do this.");
    return staffAccess;
  };

  const createStaffCheckMiddleware = (permission: Permission | undefined, requireStepUp: boolean): HttpMiddleware =>
    async (context, next) => {
      const principal = await requirePrincipal(context, verifier);
      const access = requireStaffAccess();
      const request = describeStaffRequest(context);
      await access.assertStaffMayUsePermission(principal, permission, request);
      if (requireStepUp) await access.assertRecentStepUp(principal);
      const response = await next();
      if (MUTATING_METHODS.has(request.method)) {
        await access.recordStaffAction(principal, request, { permission: permission ?? PLATFORM_STAFF_ROUTE, status: response.status });
      }
      return response;
    };

  const createPermissionCheckMiddleware = (permission: Permission | undefined): HttpMiddleware => {
    if (permission !== undefined && isPlatformPermission(permission)) return createStaffCheckMiddleware(permission, false);
    return async (context, next) => {
      const principal = await requirePrincipal(context, verifier);
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

  return {
    requirePermission: (permission, ...extra) => ({
      middleware: [createPermissionCheckMiddleware(permission), resolveViewerLocale, ...extra],
      metadata: { permission },
    }),
    requireStepUpPermission: (permission, ...extra) => ({
      middleware: [createStaffCheckMiddleware(permission, true), resolveViewerLocale, ...extra],
      metadata: { permission, stepUp: true },
    }),
    requirePlatformStaff: (...extra) => ({
      middleware: [createStaffCheckMiddleware(undefined, false), resolveViewerLocale, ...extra],
      metadata: { permission: PLATFORM_STAFF_ROUTE },
    }),
    requireSignedInUser: (...extra) => ({
      middleware: [createPermissionCheckMiddleware(undefined), resolveViewerLocale, ...extra],
      metadata: { permission: "authenticated" },
    }),
    allowAnyone: (...extra) => ({ middleware: [attachPrincipalWhenPresent, resolveViewerLocale, ...extra], metadata: { permission: PUBLIC_ROUTE } }),
  };
}
