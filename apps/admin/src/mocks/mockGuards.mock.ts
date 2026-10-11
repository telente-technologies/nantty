import type { AdminPermission } from "@/constants/adminPermissions.constant";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError } from "@/mocks/mockResponses.mock";
import type { MockPrincipal, MockRequest } from "@/mocks/mockRouter.mock";

export function requireMockPrincipal(request: MockRequest): MockPrincipal {
  if (!request.principal) throw new MockHttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return request.principal;
}

export function requireMockPermission(request: MockRequest, ...anyOfPermissions: AdminPermission[]): MockPrincipal {
  const principal = requireMockPrincipal(request);
  if (principal.role === "SUPERADMIN") return principal;
  if (!anyOfPermissions.some((permission) => principal.permissions.includes(permission))) {
    throw new MockHttpError(403, "FORBIDDEN", "Your admin permissions do not allow this.");
  }
  return principal;
}

export function requireMockSuperadmin(request: MockRequest): MockPrincipal {
  const principal = requireMockPrincipal(request);
  if (principal.role !== "SUPERADMIN") throw new MockHttpError(403, "FORBIDDEN", "Only a superadmin can do this.");
  return principal;
}

export function requireMockStepUp(request: MockRequest): void {
  const principal = requireMockPrincipal(request);
  const token = request.headers.get("x-step-up-token") ?? "";
  const grant = readMockDatabase().stepUpTokens.get(token);
  if (!grant || grant.adminId !== principal.adminId || grant.sessionId !== principal.sessionId || grant.expiresAtEpochMs < Date.now()) {
    throw new MockHttpError(403, "STEP_UP_REQUIRED", "Confirm it's you with your authenticator code to continue.");
  }
}

const consumedMoneyStepUps = new Set<string>();

export function requireMockSingleUseStepUp(request: MockRequest): void {
  requireMockStepUp(request);
  const token = request.headers.get("x-step-up-token") ?? "";
  if (consumedMoneyStepUps.has(token)) throw new MockHttpError(401, "STEP_UP_REUSED", "This confirmation was already used. Confirm it's you again for each money action.");
  consumedMoneyStepUps.add(token);
}

export function hasMockStepUp(request: MockRequest): boolean {
  try {
    requireMockStepUp(request);
    return true;
  } catch {
    return false;
  }
}
