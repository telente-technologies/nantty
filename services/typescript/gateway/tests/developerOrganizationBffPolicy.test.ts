import { describe, expect, it } from "vitest";

import { isAllowedDeveloperOrganizationRoute, shouldForwardDeveloperIdempotencyKey } from "../../../../apps/developer/src/server/developerOrganizationRoutePolicy.js";

const organizationBase = "/api/v1/developer/organizations";
const invitationBase = "/api/v1/developer/invitations";
const organizationId = "6de1c79a-00fd-4bed-ae23-fbfb678c0a19";
const resourceId = "19a6e03c-d5ce-40c9-a9d2-8aa8657e5738";

describe("Developer portal organization BFF allowlist", () => {
  it("allows each organization operation that the Identity service supports", () => {
    const allowed: readonly [string, readonly string[]][] = [
      ["GET", []], ["POST", []], ["GET", [organizationId]], ["PATCH", [organizationId]],
      ["GET", [organizationId, "access"]], ["GET", [organizationId, "roles"]],
      ["GET", [organizationId, "members"]], ["GET", [organizationId, "members", resourceId]],
      ["PATCH", [organizationId, "members", resourceId]], ["DELETE", [organizationId, "members", resourceId]],
      ["GET", [organizationId, "audit-log"]], ["POST", [organizationId, "ownership-transfer"]],
      ["GET", [organizationId, "invitations"]], ["POST", [organizationId, "invitations"]],
      ["DELETE", [organizationId, "invitations", resourceId]],
      ["GET", [organizationId, "applications"]], ["POST", [organizationId, "applications"]],
      ["GET", [organizationId, "applications", resourceId]], ["PATCH", [organizationId, "applications", resourceId]],
      ["DELETE", [organizationId, "applications", resourceId]],
      ["GET", [organizationId, "applications", resourceId, "capabilities", "me"]],
      ["GET", [organizationId, "applications", resourceId, "members"]],
      ["PUT", [organizationId, "applications", resourceId, "members", organizationId, "grants"]],
    ];
    for (const [method, path] of allowed) expect(isAllowedDeveloperOrganizationRoute(method, path, organizationBase), `${method} ${path.join("/")}`).toBe(true);
  });

  it("allows only invitation inbox reads and recipient responses", () => {
    expect(isAllowedDeveloperOrganizationRoute("GET", [], invitationBase)).toBe(true);
    expect(isAllowedDeveloperOrganizationRoute("POST", [resourceId], invitationBase)).toBe(true);
    expect(isAllowedDeveloperOrganizationRoute("DELETE", [resourceId], invitationBase)).toBe(false);
    expect(isAllowedDeveloperOrganizationRoute("POST", [], invitationBase)).toBe(false);
  });

  it("forwards idempotency keys only for organization and application creation", () => {
    expect(shouldForwardDeveloperIdempotencyKey("POST", [], organizationBase, "application-key-0001")).toBe(true);
    expect(shouldForwardDeveloperIdempotencyKey("POST", [organizationId, "applications"], organizationBase, "application-key-0001")).toBe(true);
    expect(shouldForwardDeveloperIdempotencyKey("PATCH", [organizationId, "applications"], organizationBase, "application-key-0001")).toBe(false);
    expect(shouldForwardDeveloperIdempotencyKey("POST", [organizationId, "applications", resourceId], organizationBase, "application-key-0001")).toBe(false);
    expect(shouldForwardDeveloperIdempotencyKey("POST", [organizationId, "applications"], organizationBase, "short-key")).toBe(false);
    expect(shouldForwardDeveloperIdempotencyKey("POST", [organizationId, "applications"], invitationBase, "application-key-0001")).toBe(false);
  });

  it("rejects invalid identifiers, unsupported methods, path suffixes and unknown endpoint bases", () => {
    const denied: readonly [string, readonly string[], string][] = [
      ["GET", ["org_1"], organizationBase], ["PUT", [organizationId], organizationBase],
      ["POST", [organizationId, "access"], organizationBase], ["GET", [organizationId, "members", resourceId, "extra"], organizationBase],
      ["POST", [organizationId, "applications", resourceId], organizationBase], ["GET", [organizationId, "applications", "bad-id"], organizationBase],
      ["POST", [organizationId, "applications", resourceId, "members"], organizationBase],
      ["POST", [organizationId, "applications", resourceId, "capabilities", "me"], organizationBase],
      ["GET", [organizationId, "applications", resourceId, "capabilities", "other"], organizationBase],
      ["PUT", [organizationId, "applications", resourceId, "members", "invalid", "grants"], organizationBase],
      ["POST", ["not-a-uuid"], invitationBase], ["GET", [], "/api/v1/developer/credentials"],
    ];
    for (const [method, path, base] of denied) expect(isAllowedDeveloperOrganizationRoute(method, path, base), `${method} ${base}/${path.join("/")}`).toBe(false);
  });
});
