import { decodeJwt } from "jose";

export type AccessViolationKind = "forbidden" | "privateNotFound" | "idEnumeration" | "internalPath" | "tamperedToken" | "idempotencyMismatch" | "adminRoute";

export interface ProbeSignal {
  readonly kind: AccessViolationKind;
  readonly routeTemplate: string;
  readonly resourceType: string;
  readonly resourceId?: string;
}

const privateResourceFamilies: readonly (readonly [string, string])[] = [
  ["/api/v1/seller/orders/", "sellerOrder"],
  ["/api/v1/seller/stores/", "sellerStore"],
  ["/api/v1/seller/returns/", "sellerReturn"],
  ["/api/v1/seller/customers/", "sellerCustomer"],
  ["/api/v1/orders/", "order"],
  ["/api/v1/conversations/", "conversation"],
  ["/api/v1/messages/", "message"],
  ["/api/v1/chat/", "chat"],
  ["/api/v1/disputes/", "dispute"],
  ["/api/v1/wallets/", "wallet"],
  ["/api/v1/payments/", "payment"],
  ["/api/v1/returns/", "return"],
  ["/api/v1/support/", "supportTicket"],
  ["/api/v1/notifications/", "notification"],
  ["/api/v1/subscriptions/", "subscription"],
  ["/api/v1/coins/", "coins"],
  ["/api/v1/ads/", "adCampaign"],
  ["/api/v1/media/", "media"],
  ["/api/v1/creators/me/", "creatorPrivate"],
];

const identifierPattern = /^(?:[0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-hjkmnp-tv-z]{26}|[0-9a-f]{16,}|(?=[a-z0-9_-]*[0-9])[a-z0-9_-]{16,})$/i;

export function convertPathToRouteTemplate(path: string): { readonly template: string; readonly identifiers: readonly string[] } {
  const identifiers: string[] = [];
  const segments = path.split("?")[0]!.split("/").slice(0, 12).map((segment) => {
    if (identifierPattern.test(segment)) {
      identifiers.push(segment);
      return ":id";
    }
    return segment.length > 40 ? ":segment" : segment.replace(/[^A-Za-z0-9._~-]/g, "_");
  });
  return { template: segments.join("/") || "/", identifiers };
}

export function resolvePrivateResourceType(path: string): string | undefined {
  return privateResourceFamilies.find(([prefix]) => path.startsWith(prefix))?.[1];
}

export function isAdminPath(path: string): boolean {
  return path === "/api/v1/admin" || path.startsWith("/api/v1/admin/");
}

export interface CompletedRequest {
  readonly path: string;
  readonly status: number;
  readonly hasConsumerPrincipal: boolean;
  readonly responseCode?: string | undefined;
}

export function classifyCompletedRequest(request: CompletedRequest): ProbeSignal | undefined {
  const { template, identifiers } = convertPathToRouteTemplate(request.path);
  if (isAdminPath(request.path)) {
    return request.hasConsumerPrincipal && (request.status === 401 || request.status === 403) ? { kind: "adminRoute", routeTemplate: template, resourceType: "admin" } : undefined;
  }
  if (request.status === 422 && request.responseCode === "IDEMPOTENCY_KEY_REUSED") return { kind: "idempotencyMismatch", routeTemplate: template, resourceType: resolvePrivateResourceType(request.path) ?? "mutation" };
  const resourceType = resolvePrivateResourceType(request.path);
  if (resourceType === undefined || identifiers.length === 0 || !request.hasConsumerPrincipal) return undefined;
  const resourceId = identifiers[identifiers.length - 1];
  if (request.status === 403) return { kind: "forbidden", routeTemplate: template, resourceType, ...(resourceId === undefined ? {} : { resourceId }) };
  if (request.status === 404) return { kind: "privateNotFound", routeTemplate: template, resourceType, ...(resourceId === undefined ? {} : { resourceId }) };
  return undefined;
}

export function isTamperedConsumerToken(token: string, consumerAudience: string, nowSeconds: number = Math.floor(Date.now() / 1000)): boolean {
  try {
    const claims = decodeJwt(token);
    const audiences = Array.isArray(claims.aud) ? claims.aud : claims.aud === undefined ? [] : [claims.aud];
    if (!audiences.includes(consumerAudience)) return false;
    return typeof claims.exp === "number" && claims.exp > nowSeconds;
  } catch {
    return token.split(".").length === 3;
  }
}

export function truncateIpToPrefix(ip: string | undefined): string {
  if (ip === undefined || ip === "") return "";
  const v4 = ip.replace(/^::ffff:/, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return `${v4.split(".").slice(0, 3).join(".")}.0/24`;
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}::/48`;
  return "";
}
