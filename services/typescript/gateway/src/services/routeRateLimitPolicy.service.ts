import { createHmac } from "node:crypto";

export type RouteLimitName =
  | "login"
  | "loginIp"
  | "otp"
  | "otpIp"
  | "otpSend"
  | "otpSendIp"
  | "reset"
  | "resetIp"
  | "signup"
  | "walletTransfer"
  | "report"
  | "upload"
  | "search"
  | "usernameCheck"
  | "postWrite"
  | "tagSearch"
  | "verification"
  | "mediaDownload"
  | "sellerPeopleSearch"
  | "sellerTeamWrite"
  | "sellerMoneyWrite"
  | "storeMessageSend"
  | "feedInteraction"
  | "linkPreview"
  | "widgetRead"
  | "widgetToken"
  | "offerRead"
  | "offerClaim"
  | "followWrite"
  | "mentionsResolve"
  | "commentWrite"
  | "postEngagement"
  | "messageWrite"
  | "conversationWrite"
  | "messagingKeys"
  | "supportWrite"
  | "adminEmail"
  | "financeRead"
  | "adEvent"
  | "profileRead"
  | "sitemapRead"
  | "unsubscribe";

export const defaultRouteLimitsPerMinute: Readonly<Record<RouteLimitName, number>> = {
  login: 5,
  loginIp: 20,
  otp: 5,
  otpIp: 30,
  otpSend: 3,
  otpSendIp: 20,
  reset: 3,
  resetIp: 10,
  signup: 5,
  walletTransfer: 5,
  report: 20,
  upload: 10,
  search: 30,
  usernameCheck: 30,
  postWrite: 30,
  tagSearch: 60,
  verification: 10,
  mediaDownload: 40,
  sellerPeopleSearch: 30,
  sellerTeamWrite: 30,
  sellerMoneyWrite: 5,
  storeMessageSend: 60,
  feedInteraction: 60,
  linkPreview: 30,
  widgetRead: 30,
  widgetToken: 10,
  offerRead: 30,
  offerClaim: 10,
  followWrite: 30,
  mentionsResolve: 20,
  commentWrite: 30,
  postEngagement: 60,
  messageWrite: 60,
  conversationWrite: 30,
  messagingKeys: 60,
  supportWrite: 30,
  adminEmail: 10,
  financeRead: 60,
  adEvent: 120,
  profileRead: 120,
  sitemapRead: 20,
  unsubscribe: 10,
};

export const defaultRouteLimitWindowsSeconds: Readonly<Record<RouteLimitName, number>> = {
  ...Object.fromEntries((Object.keys(defaultRouteLimitsPerMinute) as RouteLimitName[]).map((name) => [name, 60])) as Record<RouteLimitName, number>,
  login: 900,
  loginIp: 900,
  otp: 900,
  otpIp: 900,
  otpSend: 900,
  otpSendIp: 900,
  reset: 3600,
  resetIp: 3600,
  signup: 3600,
};

export interface RouteRateLimitBucket {
  readonly name: RouteLimitName;
  readonly key: string;
}

const accountScopedLimits: readonly RouteLimitName[] = [
  "report",
  "walletTransfer",
  "upload",
  "search",
  "postWrite",
  "tagSearch",
  "usernameCheck",
  "verification",
  "mediaDownload",
  "sellerPeopleSearch",
  "sellerTeamWrite",
  "sellerMoneyWrite",
  "storeMessageSend",
  "feedInteraction",
  "linkPreview",
  "widgetRead",
  "widgetToken",
  "offerClaim",
  "followWrite",
  "mentionsResolve",
  "commentWrite",
  "postEngagement",
  "messageWrite",
  "conversationWrite",
  "messagingKeys",
  "supportWrite",
  "adminEmail",
  "financeRead",
  "adEvent",
  "profileRead",
];

const preAuthAdminLoginSteps: ReadonlySet<string> = new Set(["/api/v1/admin/auth/login", "/api/v1/admin/auth/refresh", "/api/v1/admin/auth/accept-invitation", "/api/v1/admin/auth/mfa/enroll/start", "/api/v1/admin/auth/mfa/webauthn/options"]);
const preAuthAdminCodeSteps: ReadonlySet<string> = new Set(["/api/v1/admin/auth/mfa/verify", "/api/v1/admin/auth/mfa/enroll/confirm"]);

export function classifyRequestForRateLimit(method: string, path: string): RouteLimitName | undefined {
  const verb = method.toUpperCase();
  const pathname = (path.toLowerCase().split("?")[0] ?? path.toLowerCase());
  const normalizedPath = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (verb === "POST" && normalizedPath.startsWith("/api/v1/auth/login")) return "login";
  if (verb === "POST" && preAuthAdminLoginSteps.has(normalizedPath)) return "login";
  if (verb === "POST" && normalizedPath.startsWith("/api/v1/auth/otp/send")) return "otpSend";
  if (verb === "POST" && (normalizedPath.startsWith("/api/v1/auth/otp/verify") || normalizedPath.startsWith("/api/v1/auth/verify") || normalizedPath.startsWith("/api/v1/auth/mfa"))) return "otp";
  if (verb === "POST" && preAuthAdminCodeSteps.has(normalizedPath)) return "otp";
  if (verb === "POST" && (normalizedPath.startsWith("/api/v1/auth/password/reset") || normalizedPath.startsWith("/api/v1/auth/password/forgot"))) return "reset";
  if (verb === "POST" && (normalizedPath.startsWith("/api/v1/auth/register") || normalizedPath.startsWith("/api/v1/auth/signup"))) return "signup";
  if (verb === "GET" && (normalizedPath.startsWith("/api/v1/auth/username-available") || normalizedPath.startsWith("/api/v1/auth/username-suggestion"))) return "usernameCheck";
  if (verb === "POST" && normalizedPath === "/api/v1/reports") return "report";
  if (verb === "POST" && (normalizedPath === "/api/v1/media/uploads" || normalizedPath.includes("/upload-intents"))) return "upload";
  if (verb === "GET" && normalizedPath.startsWith("/api/v1/search")) return "search";
  if ((verb === "GET" || verb === "POST") && (normalizedPath === "/api/v1/admin/finance" || normalizedPath.startsWith("/api/v1/admin/finance/"))) return "financeRead";
  if (verb === "GET" && normalizedPath.startsWith("/api/v1/tags/candidates")) return "tagSearch";
  if ((verb === "POST" && normalizedPath === "/api/v1/posts") || (verb === "PUT" && /^\/api\/v1\/posts\/[^/]+\/tags$/.test(normalizedPath)) || (verb === "DELETE" && /^\/api\/v1\/posts\/[^/]+\/tags\/me$/.test(normalizedPath))) return "postWrite";
  if (verb === "POST" && normalizedPath.startsWith("/api/v1/verification/")) return "verification";
  if (verb === "POST" && (/^\/api\/v1\/coins\/transfers$/.test(normalizedPath) || /^\/api\/v1\/wallets\/[^/]+\/transfers$/.test(normalizedPath))) return "walletTransfer";
  if (verb === "POST" && /^\/api\/v1\/posts\/[^/]+\/media\/[^/]+\/download$/.test(normalizedPath)) return "mediaDownload";
  if (verb === "GET" && (normalizedPath === "/api/v1/seller/nantty-users" || normalizedPath === "/api/v1/seller/staff/candidates")) return "sellerPeopleSearch";
  if (verb !== "GET" && (normalizedPath === "/api/v1/seller/staff" || normalizedPath.startsWith("/api/v1/seller/staff/") || normalizedPath.startsWith("/api/v1/stores/team-requests/"))) return "sellerTeamWrite";
  if (verb !== "GET" && (normalizedPath.startsWith("/api/v1/seller/wallet/payouts") || normalizedPath.startsWith("/api/v1/seller/wallet/payout-accounts"))) return "sellerMoneyWrite";
  if (verb === "POST" && (/^\/api\/v1\/seller\/conversations\/[^/]+\/messages$/.test(normalizedPath) || /^\/api\/v1\/conversations\/stores\/[^/]+\/messages$/.test(normalizedPath))) return "storeMessageSend";
  if (verb === "POST" && (normalizedPath === "/api/v1/feeds/interactions" || normalizedPath === "/api/v1/feeds/interactions/batch" || normalizedPath === "/api/v1/analytics/product-interactions")) return "feedInteraction";
  if ((verb === "GET" && normalizedPath === "/api/v1/link-previews/resolve") || (verb === "POST" && /^\/api\/v1\/posts\/[^/]+\/link-preview$/.test(normalizedPath))) return "linkPreview";
  if (verb === "POST" && normalizedPath === "/api/v1/mentions/resolve") return "mentionsResolve";
  if (verb === "POST" && /^\/api\/v1\/posts\/[^/]+\/comments$/.test(normalizedPath)) return "commentWrite";
  if (verb !== "GET" && /^\/api\/v1\/comments\/[^/]+(\/like)?$/.test(normalizedPath)) return "commentWrite";
  if ((verb === "POST" || verb === "DELETE") && /^\/api\/v1\/posts\/[^/]+\/(like|share|repost|impressions|profile-visits)$/.test(normalizedPath)) return "postEngagement";
  if ((verb === "POST" || verb === "DELETE") && /^\/api\/v1\/saves(\/|$)/.test(normalizedPath)) return "postEngagement";
  if (verb === "POST" && (/^\/api\/v1\/conversations\/[^/]+\/messages$/.test(normalizedPath) || /^\/api\/v1\/messages\/[^/]+\/(reactions|poll-votes|live-location\/stop)$/.test(normalizedPath) || /^\/api\/v1\/stories\/[^/]+\/replies$/.test(normalizedPath) || normalizedPath === "/api/v1/chat/shares")) return "messageWrite";
  if (verb !== "GET" && /^\/api\/v1\/(conversations|channels|group-invitations|channel-invitations)(\/|$)/.test(normalizedPath)) return "conversationWrite";
  if (verb !== "GET" && /^\/api\/v1\/chat\/keys(\/|$)/.test(normalizedPath)) return "messagingKeys";
  if (verb !== "GET" && (/^\/api\/v1\/support(\/|$)/.test(normalizedPath) || /^\/api\/v1\/help\/topics\/[^/]+\/votes$/.test(normalizedPath))) return "supportWrite";
  if (verb !== "GET" && (/^\/api\/v1\/admin\/support\/email(\/|$)/.test(normalizedPath) || /^\/api\/v1\/admin\/legal\/.*\/(notice-draft|test-send)$/.test(normalizedPath))) return "adminEmail";
  if (verb === "POST" && normalizedPath === "/api/v1/ads/events") return "adEvent";
  if (verb === "GET" && /^\/api\/v1\/users\/(?:by-username\/)?[^/]+$/.test(normalizedPath) && normalizedPath !== "/api/v1/users/me") return "profileRead";
  if (verb === "GET" && normalizedPath === "/api/v1/sitemap/profiles") return "sitemapRead";
  if (verb === "POST" && normalizedPath === "/api/v1/email/unsubscribe") return "unsubscribe";
  if (verb === "GET" && normalizedPath.startsWith("/api/v1/widgets/")) return "widgetRead";
  if (verb === "POST" && (normalizedPath === "/api/v1/auth/widget-token" || normalizedPath === "/api/v1/auth/realtime-token")) return "widgetToken";
  if (verb === "GET" && /^\/api\/v1\/subscription-offers\/[^/]+$/.test(normalizedPath)) return "offerRead";
  if (verb === "POST" && /^\/api\/v1\/subscription-offers\/[^/]+\/claim$/.test(normalizedPath)) return "offerClaim";
  if ((verb === "POST" || verb === "DELETE") && (/^\/api\/v1\/users\/[^/]+\/follow$/.test(normalizedPath) || /^\/api\/v1\/stores\/[^/]+\/follow$/.test(normalizedPath))) return "followWrite";
  if (verb === "POST" && /^\/api\/v1\/follow-requests\/[^/]+\/(accept|reject)$/.test(normalizedPath)) return "followWrite";
  return undefined;
}

export function buildRouteRateLimitKey(name: RouteLimitName, clientIp: string | undefined, accountId: string | undefined): string {
  const subject = accountScopedLimits.includes(name) && accountId !== undefined ? `a:${accountId}` : `i:${clientIp ?? "unknown"}`;
  return `rl:route:${name}:${subject}`;
}

function readRequestBodyRecord(body: unknown): Record<string, unknown> {
  if (body !== null && typeof body === "object" && !Array.isArray(body) && !(body instanceof Uint8Array)) return body as Record<string, unknown>;
  if (typeof body !== "string" && !(body instanceof Uint8Array)) return {};
  try {
    const parsed: unknown = JSON.parse(typeof body === "string" ? body : new TextDecoder().decode(body));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function opaqueIdentityKey(body: unknown, secret: string): string | undefined {
  const record = readRequestBodyRecord(body);
  const value = [record["challengeId"], record["challengeToken"], record["identifier"], record["destination"], record["email"], record["phone"], record["otpToken"]]
    .find((candidate) => typeof candidate === "string" && candidate.trim() !== "");
  const purpose = typeof record["purpose"] === "string" ? record["purpose"].trim().toLowerCase() : "";
  return typeof value === "string" ? createHmac("sha256", secret || "nantty-rate-limit-local").update(`${value.trim().toLowerCase()}:${purpose}`).digest("hex") : undefined;
}

export function buildRouteRateLimitBuckets(
  name: RouteLimitName,
  clientIp: string | undefined,
  accountId: string | undefined,
  body: unknown,
  identityKeySecret: string,
): readonly RouteRateLimitBucket[] {
  if (name === "login" || name === "otp" || name === "otpSend" || name === "reset") {
    const identity = opaqueIdentityKey(body, identityKeySecret);
    const ipName = name === "login" ? "loginIp" : name === "otp" ? "otpIp" : name === "otpSend" ? "otpSendIp" : "resetIp";
    if (identity === undefined) return [{ name, key: `rl:route:${name}:i:${clientIp ?? "unknown"}` }];
    const buckets: RouteRateLimitBucket[] = [{ name: ipName, key: `rl:route:${name}:i:${clientIp ?? "unknown"}` }];
    buckets.push({ name, key: `rl:route:${name}:h:${identity}` });
    return buckets;
  }
  return [{ name, key: buildRouteRateLimitKey(name, clientIp, accountId) }];
}
