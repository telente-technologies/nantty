export type RouteLimitName = "login" | "otp" | "reset" | "signup" | "report" | "upload" | "search" | "usernameCheck" | "postWrite" | "tagSearch" | "verification" | "mediaDownload" | "sellerPeopleSearch" | "sellerTeamWrite" | "sellerMoneyWrite" | "storeMessageSend" | "feedInteraction" | "linkPreview" | "widgetRead" | "widgetToken" | "offerRead" | "offerClaim" | "followWrite";

export const defaultRouteLimitsPerMinute: Readonly<Record<RouteLimitName, number>> = { login: 10, otp: 5, reset: 5, signup: 10, report: 20, upload: 30, search: 60, usernameCheck: 30, postWrite: 30, tagSearch: 60, verification: 10, mediaDownload: 40, sellerPeopleSearch: 30, sellerTeamWrite: 30, sellerMoneyWrite: 10, storeMessageSend: 60, feedInteraction: 60, linkPreview: 30, widgetRead: 30, widgetToken: 10, offerRead: 30, offerClaim: 10, followWrite: 30 };

const accountScopedLimits: readonly RouteLimitName[] = ["report", "upload", "search", "postWrite", "tagSearch", "verification", "mediaDownload", "sellerPeopleSearch", "sellerTeamWrite", "sellerMoneyWrite", "storeMessageSend", "feedInteraction", "linkPreview", "widgetRead", "widgetToken", "offerClaim", "followWrite"];

const preAuthAdminLoginSteps: ReadonlySet<string> = new Set(["/api/v1/admin/auth/login", "/api/v1/admin/auth/refresh", "/api/v1/admin/auth/accept-invitation", "/api/v1/admin/auth/mfa/enroll/start", "/api/v1/admin/auth/mfa/webauthn/options"]);
const preAuthAdminCodeSteps: ReadonlySet<string> = new Set(["/api/v1/admin/auth/mfa/verify", "/api/v1/admin/auth/mfa/enroll/confirm"]);

export function classifyRequestForRateLimit(method: string, path: string): RouteLimitName | undefined {
  const verb = method.toUpperCase();
  const lowered = path.toLowerCase();
  if (verb === "POST" && lowered.startsWith("/api/v1/auth/login")) return "login";
  if (verb === "POST" && preAuthAdminLoginSteps.has(lowered)) return "login";
  if (verb === "POST" && (lowered.startsWith("/api/v1/auth/otp") || lowered.startsWith("/api/v1/auth/verify") || lowered.startsWith("/api/v1/auth/mfa"))) return "otp";
  if (verb === "POST" && preAuthAdminCodeSteps.has(lowered)) return "otp";
  if (verb === "POST" && (lowered.startsWith("/api/v1/auth/password/reset") || lowered.startsWith("/api/v1/auth/password/forgot"))) return "reset";
  if (verb === "POST" && (lowered.startsWith("/api/v1/auth/register") || lowered.startsWith("/api/v1/auth/signup"))) return "signup";
  if (verb === "GET" && lowered.startsWith("/api/v1/auth/username-available")) return "usernameCheck";
  if (verb === "POST" && lowered === "/api/v1/reports") return "report";
  if ((verb === "POST" || verb === "PUT") && (lowered.includes("/uploads") || lowered.includes("/upload-intents"))) return "upload";
  if (verb === "GET" && lowered.startsWith("/api/v1/search")) return "search";
  if (verb === "GET" && lowered.startsWith("/api/v1/tags/candidates")) return "tagSearch";
  if ((verb === "POST" && lowered === "/api/v1/posts") || (verb === "PUT" && /^\/api\/v1\/posts\/[^/]+\/tags$/.test(lowered)) || (verb === "DELETE" && /^\/api\/v1\/posts\/[^/]+\/tags\/me$/.test(lowered))) return "postWrite";
  if (verb === "POST" && lowered.startsWith("/api/v1/verification/")) return "verification";
  if (verb === "POST" && /^\/api\/v1\/posts\/[^/]+\/media\/[^/]+\/download$/.test(lowered)) return "mediaDownload";
  if (verb === "GET" && (lowered === "/api/v1/seller/zudomart-users" || lowered === "/api/v1/seller/staff/candidates")) return "sellerPeopleSearch";
  if (verb !== "GET" && (lowered === "/api/v1/seller/staff" || lowered.startsWith("/api/v1/seller/staff/") || lowered.startsWith("/api/v1/stores/team-requests/"))) return "sellerTeamWrite";
  if (verb !== "GET" && (lowered.startsWith("/api/v1/seller/wallet/payouts") || lowered.startsWith("/api/v1/seller/wallet/payout-accounts"))) return "sellerMoneyWrite";
  if (verb === "POST" && (/^\/api\/v1\/seller\/conversations\/[^/]+\/messages$/.test(lowered) || /^\/api\/v1\/conversations\/stores\/[^/]+\/messages$/.test(lowered))) return "storeMessageSend";
  if (verb === "POST" && (lowered === "/api/v1/feeds/interactions" || lowered === "/api/v1/feeds/interactions/batch" || lowered === "/api/v1/analytics/product-interactions")) return "feedInteraction";
  if ((verb === "GET" && lowered === "/api/v1/link-previews/resolve") || (verb === "POST" && /^\/api\/v1\/posts\/[^/]+\/link-preview$/.test(lowered))) return "linkPreview";
  if (verb === "GET" && lowered.startsWith("/api/v1/widgets/")) return "widgetRead";
  if (verb === "POST" && (lowered === "/api/v1/auth/widget-token" || lowered === "/api/v1/auth/realtime-token")) return "widgetToken";
  if (verb === "GET" && /^\/api\/v1\/subscription-offers\/[^/]+$/.test(lowered)) return "offerRead";
  if (verb === "POST" && /^\/api\/v1\/subscription-offers\/[^/]+\/claim$/.test(lowered)) return "offerClaim";
  if ((verb === "POST" || verb === "DELETE") && /^\/api\/v1\/users\/[^/]+\/follow$/.test(lowered)) return "followWrite";
  if (verb === "POST" && /^\/api\/v1\/follow-requests\/[^/]+\/(accept|reject)$/.test(lowered)) return "followWrite";
  return undefined;
}

export function buildRouteRateLimitKey(name: RouteLimitName, clientIp: string | undefined, accountId: string | undefined): string {
  const subject = accountScopedLimits.includes(name) && accountId !== undefined ? `a:${accountId}` : `i:${clientIp ?? "unknown"}`;
  return `rl:route:${name}:${subject}`;
}
