import { extractBearerTokenFromAuthorizationHeader } from "./accessTokenVerifier.service.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export const anonymousMutationAllowlist: readonly RegExp[] = [
  /^\/webhooks\//,
  /^\/api\/v1\/live\/webhooks\//,
  /^\/api\/v1\/webhooks\/smile-id$/,
  /^\/api\/v1\/webhooks\/smile-id\/(web-sdk|hosted-link)$/,
  /^\/api\/v1\/auth\/(otp\/send|otp\/verify|password\/reset|google|apple|login|refresh|register|sso\/token)$/,
  /^\/api\/v1\/auth\/messenger\/authorizations(\/[^/]+\/(verify-code|complete|recovery\/email|recovery\/verify))?$/,
  /^\/api\/v1\/admin\/auth\/(login|refresh|accept-invitation|mfa\/verify|mfa\/enroll\/start|mfa\/enroll\/confirm|mfa\/webauthn\/options)$/,
  /^\/api\/v1\/consents$/,
  /^\/api\/v1\/email\/unsubscribe$/,
  /^\/api\/v1\/mentions\/resolve$/,
];

export function isAnonymousMutationAllowed(path: string): boolean {
  return anonymousMutationAllowlist.some((pattern) => pattern.test(path));
}

export function shouldRefuseAnonymousMutation(method: string, path: string, authorizationHeader: string | undefined): boolean {
  if (safeMethods.has(method.toUpperCase()) || isAnonymousMutationAllowed(path)) return false;
  return !(path.startsWith("/api/v1/admin/") && extractBearerTokenFromAuthorizationHeader(authorizationHeader) !== undefined);
}
