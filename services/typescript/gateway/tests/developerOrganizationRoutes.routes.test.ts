import { describe, expect, it } from "vitest";

import { resolveUpstreamRouteForRequest } from "../src/routes/upstream.routes.js";

describe("developer organization routes", () => {
  it("routes approved Business Messaging application previews only to authenticated Identity reads", () => {
    const path = "/api/v1/account/business-messaging/applications/19a6e03c-d5ce-40c9-a9d2-8aa8657e5738";
    expect(resolveUpstreamRouteForRequest("GET", path)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["GET"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("POST", path)).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("GET", `${path}/extra`)).toBeUndefined();
  });
  it("routes account-controlled Business Messaging consent only to authenticated Identity operations", () => {
    const path = "/api/v1/account/business-messaging/consents";
    expect(resolveUpstreamRouteForRequest("GET", path)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["GET", "POST"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("POST", path)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["GET", "POST"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("DELETE", `${path}/6de1c79a-00fd-4bed-ae23-fbfb678c0a19`)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["DELETE"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("PUT", path)).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("POST", `${path}/6de1c79a-00fd-4bed-ae23-fbfb678c0a19`)).toBeUndefined();
  });

  it("routes store-level Business Messaging authorization only to authenticated Identity operations", () => {
    const path = "/api/v1/account/business-messaging/authorizations";
    expect(resolveUpstreamRouteForRequest("GET", path)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["GET", "POST"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("POST", path)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["GET", "POST"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("DELETE", `${path}/6de1c79a-00fd-4bed-ae23-fbfb678c0a19`)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["DELETE"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("PUT", path)).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("POST", `${path}/6de1c79a-00fd-4bed-ae23-fbfb678c0a19`)).toBeUndefined();
  });

  it.each(["GET", "POST"])("%s organization endpoint requires Nantty identity", (method) => {
    expect(resolveUpstreamRouteForRequest(method, "/api/v1/developer/organizations")).toMatchObject({
      upstream: "identity",
      authentication: "required",
    });
  });

  it("routes organization capabilities only to Identity for authenticated reads", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/access")).toMatchObject({
      upstream: "identity",
      authentication: "required",
      methods: ["GET"],
      exactPathOnly: true,
    });
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/access")).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/access/extra")).toBeUndefined();
  });

  it("routes organization details only to Identity for authenticated reads", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19")).toMatchObject({
      upstream: "identity",
      authentication: "required",
      methods: ["GET"],
      exactPathOnly: true,
    });
    expect(resolveUpstreamRouteForRequest("PATCH", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19")).toMatchObject({
      upstream: "identity",
      authentication: "required",
      methods: ["PATCH"],
      exactPathOnly: true,
    });
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/unknown")).toBeUndefined();
  });

  it("routes the owner-only audit log to authenticated Identity reads", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/audit-log")).toMatchObject({
      upstream: "identity",
      authentication: "required",
      methods: ["GET"],
      exactPathOnly: true,
    });
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/audit-log")).toBeUndefined();
  });

  it("routes ownership transfer only as an authenticated Identity action", () => {
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/ownership-transfer")).toMatchObject({
      upstream: "identity",
      authentication: "required",
      methods: ["POST"],
      exactPathOnly: true,
    });
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/ownership-transfer")).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/ownership-transfer/extra")).toBeUndefined();
  });

  it("routes the membership-scoped role catalog only to Identity", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/roles")).toMatchObject({
      upstream: "identity",
      authentication: "required",
      methods: ["GET"],
      exactPathOnly: true,
    });
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/roles")).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/roles/extra")).toBeUndefined();
  });

  it("routes organization invitation management only to authenticated Identity operations", () => {
    const organization = "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/invitations";
    expect(resolveUpstreamRouteForRequest("GET", organization)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["GET", "POST"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("POST", organization)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["GET", "POST"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("DELETE", `${organization}/19a6e03c-d5ce-40c9-a9d2-8aa8657e5738`)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["DELETE"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("POST", `${organization}/not-a-uuid`)).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("PATCH", organization)).toBeUndefined();
  });

  it("routes organization application registry operations only to authenticated Identity", () => {
    const organization = "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/applications";
    expect(resolveUpstreamRouteForRequest("GET", organization)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["GET", "POST"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("POST", organization)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["GET", "POST"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("PATCH", organization)).toBeUndefined();
    const application = `${organization}/19a6e03c-d5ce-40c9-a9d2-8aa8657e5738`;
    for (const method of ["GET", "PATCH", "DELETE"]) expect(resolveUpstreamRouteForRequest(method, application)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["GET", "PATCH", "DELETE"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("GET", `${application}/members`)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["GET"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("GET", `${application}/capabilities/me`)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["GET"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("POST", `${application}/capabilities/me`)).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("PUT", `${application}/members/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/grants`)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["PUT"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("POST", `${application}/members/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/grants`)).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("POST", application)).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("GET", `${application}/credentials`)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["GET", "POST"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("POST", `${application}/credentials`)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["GET", "POST"], exactPathOnly: true });
    const credential = `${application}/credentials/19a6e03c-d5ce-40c9-a9d2-8aa8657e5738`;
    expect(resolveUpstreamRouteForRequest("POST", `${credential}/rotate`)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["POST"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("GET", `${credential}/rotate`)).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("POST", `${credential}/unknown`)).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("DELETE", `${application}/credentials/19a6e03c-d5ce-40c9-a9d2-8aa8657e5738`)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["DELETE"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("GET", `${application}/webhooks`)).toMatchObject({ upstream: "identity", authentication: "required", methods: ["GET", "POST"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("GET", `${application}/unknown`)).toBeUndefined();
  });

  it("routes the signed-in account invitation inbox and responses only to Identity", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/developer/invitations")).toMatchObject({ upstream: "identity", authentication: "required", methods: ["GET"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/developer/invitations/19a6e03c-d5ce-40c9-a9d2-8aa8657e5738")).toMatchObject({ upstream: "identity", authentication: "required", methods: ["POST"], exactPathOnly: true });
    expect(resolveUpstreamRouteForRequest("DELETE", "/api/v1/developer/invitations/19a6e03c-d5ce-40c9-a9d2-8aa8657e5738")).toBeUndefined();
  });

  it("routes member listing only to authenticated Identity reads", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/members")).toMatchObject({
      upstream: "identity",
      authentication: "required",
      methods: ["GET"],
      exactPathOnly: true,
    });
    expect(resolveUpstreamRouteForRequest("DELETE", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/members")).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/members/member_1/extra")).toBeUndefined();
  });

  it("routes organization-scoped member details only to authenticated Identity reads", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/members/19a6e03c-d5ce-40c9-a9d2-8aa8657e5738")).toMatchObject({
      upstream: "identity",
      authentication: "required",
      methods: ["GET"],
      exactPathOnly: true,
    });
    expect(resolveUpstreamRouteForRequest("PATCH", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/members/19a6e03c-d5ce-40c9-a9d2-8aa8657e5738")).toMatchObject({
      upstream: "identity",
      authentication: "required",
      methods: ["PATCH"],
      exactPathOnly: true,
    });
    expect(resolveUpstreamRouteForRequest("DELETE", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/members/19a6e03c-d5ce-40c9-a9d2-8aa8657e5738")).toMatchObject({
      upstream: "identity",
      authentication: "required",
      methods: ["DELETE"],
      exactPathOnly: true,
    });
  });

  it("does not expose unsupported developer API routes", () => {
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/developer/credentials")).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/developer/organizations/org_1/keys")).toBeUndefined();
  });
});
