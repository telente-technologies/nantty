import type { UpstreamRoute } from "./upstream.routes.js";

export const verificationMoneyRoutes: readonly UpstreamRoute[] = [
  { pathPrefix: "/api/v1/verification/plans", upstream: "money", authentication: "required", methods: ["GET"], exactPathOnly: true },
  { pathPrefix: "/api/v1/verification/discounts", upstream: "money", authentication: "required", methods: ["GET"], exactPathOnly: true },
  { pathPrefix: "/api/v1/verification/subscription/cancel", upstream: "money", authentication: "required", methods: ["POST"], exactPathOnly: true },
  { pathPrefix: "/api/v1/verification/black/billing", upstream: "money", authentication: "required", methods: ["GET"], exactPathOnly: true },
  { pathPrefix: "/api/v1/verification/black/checkout", upstream: "money", authentication: "required", methods: ["POST"], exactPathOnly: true },
  { pathPrefix: "/api/v1/verification/black/payment-method", upstream: "money", authentication: "required", methods: ["POST"], exactPathOnly: true },
  { pathPrefix: "/api/v1/verification/black/reactivate", upstream: "money", authentication: "required", methods: ["POST"], exactPathOnly: true },
  { pathPrefix: "/api/v1/verification/black/cancel", upstream: "money", authentication: "required", methods: ["POST"], exactPathOnly: true },
];
