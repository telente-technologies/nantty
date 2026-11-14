import { describe, expect, it } from "vitest";

import { resolveUpstreamRouteForRequest } from "../src/routes/upstream.routes.js";

describe("developer organization routes", () => {
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
    expect(resolveUpstreamRouteForRequest("PATCH", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19")).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/developer/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/unknown")).toBeUndefined();
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
