import type { UpstreamRoute } from "./upstream.routes.js";

export const widgetRoutes: readonly UpstreamRoute[] = [
  { pathPrefix: "/api/v1/auth/widget-token", upstream: "identity", authentication: "required", methods: ["POST", "DELETE"], exactPathOnly: true },
  { pathPrefix: "/api/v1/auth/realtime-token", upstream: "identity", authentication: "required", methods: ["POST"], exactPathOnly: true },
  { pathPrefix: "/api/v1/widgets/orders", upstream: "commerce", authentication: "required", methods: ["GET"], exactPathOnly: true, acceptsWidgetToken: true },
  { pathPrefix: "/api/v1/widgets/seller-today", upstream: "commerce", authentication: "required", methods: ["GET"], exactPathOnly: true, acceptsWidgetToken: true },
  { pathPrefix: "/api/v1/widgets/live-now", upstream: "live", authentication: "required", methods: ["GET"], exactPathOnly: true, acceptsWidgetToken: true },
  { pathPrefix: "/api/v1/widgets/creator-today", upstream: "money", authentication: "required", methods: ["GET"], exactPathOnly: true, acceptsWidgetToken: true },
  { pathPrefix: "/api/v1/widgets/stories", upstream: "social", authentication: "required", methods: ["GET"], exactPathOnly: true, acceptsWidgetToken: true },
];
