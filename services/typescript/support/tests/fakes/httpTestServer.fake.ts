import { HttpMiddlewarePipeline, createHttpServer, createNodeHttpAdapter, createResponseContext, type HttpRequestContext } from "@zudojs/http";
import { SignJWT, generateKeyPair, type JWTVerifyGetKey } from "jose";

import { createJwtStaffAuthenticator } from "../../src/middlewares/staffAuth.middleware.js";
import { buildSupportRouter } from "../../src/routes/index.js";
import { createSupportHarness } from "./supportHarness.fake.js";

export const internalToken = "test-support-internal-token-0123456789";
const issuer = "https://api.zudomart.test";

export async function startSupportTestServer() {
  const harness = await createSupportHarness();
  const { publicKey, privateKey } = await generateKeyPair("EdDSA");
  const router = buildSupportRouter({
    ticketStore: harness.ticketStore, helpStore: harness.helpStore, identity: harness.identity, clock: harness.clock, internalToken, mediaPublicBaseUrls: ["https://media.zudomart.com"],
    staffAuthenticator: createJwtStaffAuthenticator({ jwksUrl: "https://unused.test/jwks", issuer }, (async () => publicKey) as unknown as JWTVerifyGetKey),
    probeDatabase: undefined, runAutoFaqNow: async () => 0,
  });
  const pipeline = new HttpMiddlewarePipeline({ middlewares: [async (context) => (await router.dispatch(context.request, { signal: context.signal })).response] });
  const server = createHttpServer({ adapter: createNodeHttpAdapter({ host: "127.0.0.1", port: 0, maxBodySize: 65_536, trustProxy: true }), handler: (request: HttpRequestContext) => pipeline.execute(request, createResponseContext()) });
  await server.start();
  const signStaffToken = (staffId: string, name: string, permissions: readonly string[], audience = "zudomart-admin") =>
    new SignJWT({ roles: ["support", `name:${name}`, ...permissions.map((permission) => `perm:${permission}`)] }).setProtectedHeader({ alg: "EdDSA" }).setSubject(staffId).setIssuer(issuer).setAudience(audience).setExpirationTime("5m").sign(privateKey);
  return { harness, baseUrl: `http://127.0.0.1:${server.address?.port}`, signStaffToken, stop: async () => void (await server.stop()) };
}
