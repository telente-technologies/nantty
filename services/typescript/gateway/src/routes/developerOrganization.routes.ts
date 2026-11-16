import type { UpstreamRoute } from "./upstream.routes.js";

export const developerOrganizationRoutes: readonly UpstreamRoute[] = [
  { pathPrefix: "/api/v1/developer/organizations", upstream: "identity", authentication: "required", methods: ["GET", "POST"], exactPathOnly: true },
  { pathPrefix: "/api/v1/developer/organizations/*", upstream: "identity", authentication: "required", methods: ["GET"], exactPathOnly: true },
  { pathPrefix: "/api/v1/developer/organizations/*", upstream: "identity", authentication: "required", methods: ["PATCH"], exactPathOnly: true },
  { pathPrefix: "/api/v1/developer/organizations/*/roles", upstream: "identity", authentication: "required", methods: ["GET"], exactPathOnly: true },
  { pathPrefix: "/api/v1/developer/organizations/*/audit-log", upstream: "identity", authentication: "required", methods: ["GET"], exactPathOnly: true },
  { pathPrefix: "/api/v1/developer/organizations/*/members", upstream: "identity", authentication: "required", methods: ["GET"], exactPathOnly: true },
  { pathPrefix: "/api/v1/developer/organizations/*/members/*", upstream: "identity", authentication: "required", methods: ["GET"], exactPathOnly: true },
  { pathPrefix: "/api/v1/developer/organizations/*/members/*", upstream: "identity", authentication: "required", methods: ["PATCH"], exactPathOnly: true },
  { pathPrefix: "/api/v1/developer/organizations/*/members/*", upstream: "identity", authentication: "required", methods: ["DELETE"], exactPathOnly: true },
  { pathPrefix: "/api/v1/developer/organizations/*/access", upstream: "identity", authentication: "required", methods: ["GET"], exactPathOnly: true },
  { pathPrefix: "/api/v1/developer/organizations/*/ownership-transfer", upstream: "identity", authentication: "required", methods: ["POST"], exactPathOnly: true },
  { pathPrefix: "/api/v1/developer/organizations/*/invitations", upstream: "identity", authentication: "required", methods: ["GET", "POST"], exactPathOnly: true },
  { pathPrefix: "/api/v1/developer/organizations/*/invitations/*", upstream: "identity", authentication: "required", methods: ["DELETE"], exactPathOnly: true },
  { pathPrefix: "/api/v1/developer/organizations/*/applications", upstream: "identity", authentication: "required", methods: ["GET", "POST"], exactPathOnly: true },
  { pathPrefix: "/api/v1/developer/organizations/*/applications/*", upstream: "identity", authentication: "required", methods: ["GET", "PATCH", "DELETE"], exactPathOnly: true },
  { pathPrefix: "/api/v1/developer/organizations/*/applications/*/capabilities/me", upstream: "identity", authentication: "required", methods: ["GET"], exactPathOnly: true },
];
