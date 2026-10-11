import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type CryptoKey, type JWTVerifyGetKey } from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import { AccessTokenVerifier, type SessionRevocationSource } from "../src/services/accessTokenVerifier.service.js";

const issuer = "https://auth.zudomart.test";
const options = { jwksUrl: "http://unused.invalid/jwks.json", issuer, audience: "zudomart-api" };

describe("gateway access tokens honour the shared session denylist", () => {
  let privateKey: CryptoKey;
  let keySet: JWTVerifyGetKey;
  const revoked = new Set<string>();
  const revocations: SessionRevocationSource = { isSessionRevoked: async (sessionId) => revoked.has(sessionId) };

  const sign = (sessionId: string, audience = "zudomart-api") =>
    new SignJWT({ sid: sessionId, roles: [] }).setProtectedHeader({ alg: "EdDSA", kid: "k1" }).setIssuer(issuer).setAudience(audience)
      .setSubject("account-1").setIssuedAt().setExpirationTime("10m").sign(privateKey);

  beforeAll(async () => {
    const pair = await generateKeyPair("EdDSA", { crv: "Ed25519" });
    privateKey = pair.privateKey;
    keySet = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "EdDSA" }] });
  });

  it("refuses a token whose session was revoked after it was issued", async () => {
    const verifier = new AccessTokenVerifier(options, keySet, revocations);
    const token = await sign("session-live");
    expect(await verifier.verifyAccessTokenWithJwks(token)).toMatchObject({ sessionId: "session-live" });
    revoked.add("session-live");
    expect(await verifier.verifyAccessTokenWithJwks(token)).toBeUndefined();
  });

  it("refuses revoked staff sessions too", async () => {
    revoked.add("staff-session");
    const verifier = new AccessTokenVerifier(options, keySet, revocations);
    expect(await verifier.verifyStaffAccessToken(await sign("staff-session", "zudomart-admin"))).toBeUndefined();
  });

  it("fails closed when the denylist cannot be read", async () => {
    const broken: SessionRevocationSource = { isSessionRevoked: async () => { throw new Error("valkey down"); } };
    const verifier = new AccessTokenVerifier(options, keySet, broken);
    expect(await verifier.verifyAccessTokenWithJwks(await sign("session-any"))).toBeUndefined();
  });
});
