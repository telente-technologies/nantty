import { createRequestContext, createResponseContext } from "@nantty/fastify-platform";
import { describe, expect, it } from "vitest";

import { createClientIpDenylistMiddleware } from "../src/middlewares/clientIpDenylist.middleware.js";

describe("client IP denylist", () => {
  it("matches configured IPv4 and IPv6 networks and IPv4-mapped addresses", async () => {
    const middleware = createClientIpDenylistMiddleware(["198.51.100.0/24", "2001:db8:dead::/48"]);
    for (const remoteAddress of ["198.51.100.27", "::ffff:198.51.100.27", "2001:db8:dead::27"]) {
      const response = await middleware({ request: createRequestContext({ method: "GET", url: "/", remoteAddress }) }, async () => createResponseContext({ status: 200 }));
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: "IP_BLOCKED" });
    }
  });

  it("uses the resolved client address and ignores forwarding headers in the request context", async () => {
    const middleware = createClientIpDenylistMiddleware(["198.51.100.0/24"]);
    const response = await middleware({
      request: createRequestContext({ method: "GET", url: "/", headers: { "x-forwarded-for": "198.51.100.27" }, remoteAddress: "203.0.113.8" }),
    }, async () => createResponseContext({ status: 200 }));
    expect(response.status).toBe(200);
  });

  it("rejects invalid network configuration and fails closed without a resolved IP", async () => {
    expect(() => createClientIpDenylistMiddleware(["198.51.100.0/33"])).toThrow();
    const middleware = createClientIpDenylistMiddleware(["198.51.100.0/24"]);
    const response = await middleware({ request: createRequestContext({ method: "GET", url: "/" }) }, async () => createResponseContext({ status: 200 }));
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: "IP_BLOCKED" });
  });
});
