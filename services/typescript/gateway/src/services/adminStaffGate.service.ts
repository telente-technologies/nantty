import { isAdminPath } from "./security/accessProbeClassifier.service.js";
import { extractBearerTokenFromAuthorizationHeader, type AccessTokenVerifier } from "./accessTokenVerifier.service.js";

const publicAdminAuthPaths: ReadonlySet<string> = new Set([
  "/api/v1/admin/auth/login",
  "/api/v1/admin/auth/refresh",
  "/api/v1/admin/auth/accept-invitation",
  "/api/v1/admin/auth/mfa/verify",
  "/api/v1/admin/auth/mfa/enroll/start",
  "/api/v1/admin/auth/mfa/enroll/confirm",
  "/api/v1/admin/auth/mfa/webauthn/options",
]);

export function doesAdminRequestNeedStaffToken(method: string, path: string): boolean {
  if (!isAdminPath(path) || method.toUpperCase() === "OPTIONS") return false;
  return !(method.toUpperCase() === "POST" && publicAdminAuthPaths.has(path));
}

export async function isStaffRequestAuthenticated(verifier: AccessTokenVerifier, authorizationHeader: string | undefined): Promise<boolean> {
  const token = extractBearerTokenFromAuthorizationHeader(authorizationHeader);
  return token !== undefined && (await verifier.verifyStaffAccessToken(token)) !== undefined;
}
