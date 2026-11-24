import type { VerifiedPrincipal } from "./accessTokenVerifier.service.js";

const suspendedAccountAllowedRoutes: ReadonlyArray<{ readonly methods?: readonly string[]; readonly pattern: RegExp }> = [
  { methods: ["POST"], pattern: /^\/api\/v1\/auth\/(logout|refresh)$/ },
  { methods: ["GET"], pattern: /^\/api\/v1\/account\/status$/ },
  { methods: ["POST"], pattern: /^\/api\/v1\/account\/status\/strikes\/[^/]+\/appeal$/ },
  { methods: ["GET"], pattern: /^\/api\/v1\/moderation\/decisions\/me$/ },
  { methods: ["POST"], pattern: /^\/api\/v1\/moderation\/decisions\/[^/]+\/appeal$/ },
  { methods: ["GET"], pattern: /^\/api\/v1\/users\/me\/suspension$/ },
  { methods: ["POST"], pattern: /^\/api\/v1\/users\/me\/suspension\/appeal$/ },
  { methods: ["GET", "POST"], pattern: /^\/api\/v1\/users\/me\/data-exports$/ },
  { methods: ["GET"], pattern: /^\/api\/v1\/users\/me\/data-exports\/[^/]+$/ },
  { methods: ["POST"], pattern: /^\/api\/v1\/live-safety\/[^/]+\/appeal$/ },
  { methods: ["GET"], pattern: /^\/api\/v1\/legal\/policy-versions\/current$/ },
  { methods: ["GET"], pattern: /^\/api\/v1\/policies(\/|$)/ },
  { methods: ["GET", "PUT"], pattern: /^\/api\/v1\/consents$/ },
  { methods: ["GET", "PUT"], pattern: /^\/api\/v1\/users\/me\/consents$/ },
  { methods: ["GET", "POST"], pattern: /^\/api\/v1\/users\/me\/terms-acceptances$/ },
];

export function isPathAllowedForSuspendedAccount(method: string, path: string): boolean {
  const normalizedPath = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  const verb = method.toUpperCase();
  return suspendedAccountAllowedRoutes.some((entry) => (entry.methods === undefined || entry.methods.includes(verb)) && entry.pattern.test(normalizedPath));
}

export function shouldRefuseSuspendedPrincipal(principal: VerifiedPrincipal | undefined, method: string, path: string): boolean {
  if (principal === undefined || !principal.roles.includes("suspended")) return false;
  return !isPathAllowedForSuspendedAccount(method, path);
}
