export type RouteLimitName = "login" | "otp" | "reset" | "signup" | "report" | "upload" | "search" | "usernameCheck";

export const defaultRouteLimitsPerMinute: Readonly<Record<RouteLimitName, number>> = { login: 10, otp: 5, reset: 5, signup: 10, report: 20, upload: 30, search: 60, usernameCheck: 30 };

const accountScopedLimits: readonly RouteLimitName[] = ["report", "upload", "search"];

export function classifyRequestForRateLimit(method: string, path: string): RouteLimitName | undefined {
  const verb = method.toUpperCase();
  const lowered = path.toLowerCase();
  if (verb === "POST" && lowered.startsWith("/api/v1/auth/login")) return "login";
  if (verb === "POST" && (lowered.startsWith("/api/v1/auth/otp") || lowered.startsWith("/api/v1/auth/verify") || lowered.startsWith("/api/v1/auth/mfa"))) return "otp";
  if (verb === "POST" && (lowered.startsWith("/api/v1/auth/password/reset") || lowered.startsWith("/api/v1/auth/password/forgot"))) return "reset";
  if (verb === "POST" && (lowered.startsWith("/api/v1/auth/register") || lowered.startsWith("/api/v1/auth/signup"))) return "signup";
  if (verb === "GET" && lowered.startsWith("/api/v1/auth/username-available")) return "usernameCheck";
  if (verb === "POST" && lowered === "/api/v1/reports") return "report";
  if ((verb === "POST" || verb === "PUT") && (lowered.includes("/uploads") || lowered.includes("/upload-intents"))) return "upload";
  if (verb === "GET" && lowered.startsWith("/api/v1/search")) return "search";
  return undefined;
}

export function buildRouteRateLimitKey(name: RouteLimitName, clientIp: string | undefined, accountId: string | undefined): string {
  const subject = accountScopedLimits.includes(name) && accountId !== undefined ? `a:${accountId}` : `i:${clientIp ?? "unknown"}`;
  return `rl:route:${name}:${subject}`;
}
