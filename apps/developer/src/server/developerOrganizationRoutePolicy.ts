const organizationBasePath = "/api/v1/developer/organizations";
const invitationInboxBasePath = "/api/v1/developer/invitations";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{16,128}$/;

export function isAllowedDeveloperOrganizationRoute(method: string, path: readonly string[], basePath: string): boolean {
  if (basePath === invitationInboxBasePath) {
    if (path.length === 0) return method === "GET";
    return path.length === 1 && uuidPattern.test(path[0] ?? "") && method === "POST";
  }
  if (basePath !== organizationBasePath) return false;
  if (path.length === 0) return method === "GET" || method === "POST";
  if (!uuidPattern.test(path[0] ?? "")) return false;
  if (path.length === 1) return method === "GET" || method === "PATCH";
  const resource = path[1];
  if (path.length === 2 && resource === "ownership-transfer") return method === "POST";
  if (path.length === 2 && resource === "applications") return method === "GET" || method === "POST";
  if (path.length === 3 && resource === "applications" && uuidPattern.test(path[2] ?? "")) return ["GET", "PATCH", "DELETE"].includes(method);
  if (path.length === 5 && resource === "applications" && uuidPattern.test(path[2] ?? "") && path[3] === "capabilities" && path[4] === "me") return method === "GET";
  if (path.length === 4 && resource === "applications" && uuidPattern.test(path[2] ?? "") && path[3] === "members") return method === "GET";
  if (path.length === 6 && resource === "applications" && uuidPattern.test(path[2] ?? "") && path[3] === "members" && uuidPattern.test(path[4] ?? "") && path[5] === "grants") return method === "PUT";
  if (path.length === 2 && resource === "invitations") return method === "GET" || method === "POST";
  if (path.length === 3 && resource === "invitations" && uuidPattern.test(path[2] ?? "")) return method === "DELETE";
  if (path.length === 2 && ["access", "roles", "members", "audit-log"].includes(resource ?? "")) return method === "GET";
  return path.length === 3 && resource === "members" && uuidPattern.test(path[2] ?? "") && ["GET", "PATCH", "DELETE"].includes(method);
}

export function shouldForwardDeveloperIdempotencyKey(method: string, path: readonly string[], basePath: string, key: string | null): key is string {
  if (method !== "POST" || !key || !idempotencyKeyPattern.test(key)) return false;
  if (basePath !== organizationBasePath) return false;
  return path.length === 0 || (path.length === 2 && uuidPattern.test(path[0] ?? "") && path[1] === "applications");
}
