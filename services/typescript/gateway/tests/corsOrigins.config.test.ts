import { afterEach, describe, expect, it } from "vitest";

import { loadGatewayConfigFromEnvironment } from "../src/configs/gateway.config.js";

const required = { AUTH_JWKS_URL: "http://identity/jwks.json", AUTH_TOKEN_ISSUER: "http://identity", GATEWAY_IDENTITY_SECRET: "local-only-gateway-identity-secret-0123456789", UPSTREAM_IDENTITY_URL: "http://identity" };
const touched = [...Object.keys(required), "CORS_ORIGINS", "CORS_ORIGIN_WEB", "CORS_ORIGIN_WEBAPP"];
const saved = Object.fromEntries(touched.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of touched) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

describe("gateway CORS origins", () => {
  it("allows the marketing site next to the apps, from the list or the per-app variables", () => {
    Object.assign(process.env, required, { CORS_ORIGINS: "http://localhost:3500,http://localhost:3100", CORS_ORIGIN_WEB: "https://zudomart.com", CORS_ORIGIN_WEBAPP: "https://app.zudomart.com" });
    expect(loadGatewayConfigFromEnvironment().corsOrigins).toEqual(["http://localhost:3500", "http://localhost:3100", "https://zudomart.com", "https://app.zudomart.com"]);
  });

  it("refuses a wildcard origin", () => {
    Object.assign(process.env, required, { CORS_ORIGINS: "*" });
    expect(() => loadGatewayConfigFromEnvironment()).toThrow(/CORS_ORIGINS/);
  });
});
