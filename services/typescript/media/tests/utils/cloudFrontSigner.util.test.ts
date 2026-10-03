import { createVerify, generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createMediaUrlSigner } from "../../src/integrations/cdnMediaUrlSigner.integration.js";
import { signCloudFrontUrl } from "../../src/utils/cloudFrontSigner.util.js";
import { FakeObjectStorage } from "../fakes/fakeObjectStorage.js";
import { testConfig } from "../fakes/pipelineHarness.js";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
const fromCloudFrontBase64 = (value: string) => Buffer.from(value.replaceAll("-", "+").replaceAll("_", "=").replaceAll("~", "/"), "base64");

describe("CloudFront signed URLs", () => {
  it("produces a canned-policy signature that verifies with the public key", () => {
    const expiresAt = new Date("2026-10-03T13:00:00Z");
    const url = "https://private.cdn.test/p/abc/w640.jpg";
    const signed = new URL(signCloudFrontUrl({ url, keyPairId: "K123", privateKeyPem: privateKey, expiresAt }));
    expect(signed.searchParams.get("Expires")).toBe(String(expiresAt.getTime() / 1000));
    expect(signed.searchParams.get("Key-Pair-Id")).toBe("K123");
    const policy = JSON.stringify({ Statement: [{ Resource: url, Condition: { DateLessThan: { "AWS:EpochTime": expiresAt.getTime() / 1000 } } }] });
    const verifier = createVerify("RSA-SHA1").update(policy);
    expect(verifier.verify(publicKey, fromCloudFrontBase64(signed.searchParams.get("Signature") ?? ""))).toBe(true);
    expect(signed.searchParams.get("Signature")).not.toMatch(/[+=/]/);
  });
});

describe("media url signer", () => {
  const clock = { now: () => new Date("2026-10-03T12:00:00Z") };

  it("serves plain object store urls locally when no CDN is configured", async () => {
    const base = testConfig();
    const config = { ...base, storage: { ...base.storage, endpoint: "http://localhost:18333", publicEndpoint: "http://localhost:18333", forcePathStyle: true }, cdn: { ...base.cdn, baseUrl: undefined } };
    const signer = createMediaUrlSigner({ config, storage: new FakeObjectStorage(), clock });
    expect(signer.publicUrl("m/1/w640.avif")).toBe("http://localhost:18333/zudomart-media-public/m/1/w640.avif");
    expect(await signer.privateUrl("zudomart-media-private", "p/1/original.pdf", 60)).toBe("https://signed.test/zudomart-media-private/p/1/original.pdf?expires=60");
  });

  it("uses the CDN base for public urls and CloudFront signing for private delivery when configured", async () => {
    const base = testConfig();
    const config = { ...base, cdn: { ...base.cdn, baseUrl: "https://cdn.zudomart.test/", privateBaseUrl: "https://private.zudomart.test", keyPairId: "K9", privateKeyPem: privateKey } };
    const signer = createMediaUrlSigner({ config, storage: new FakeObjectStorage(), clock });
    expect(signer.publicUrl("m/1/poster.jpg")).toBe("https://cdn.zudomart.test/m/1/poster.jpg");
    const viaCdn = new URL(await signer.privateUrl("zudomart-media-private", "p/1/w640.jpg", 300, { allowCdn: true }));
    expect(viaCdn.origin).toBe("https://private.zudomart.test");
    expect(viaCdn.searchParams.get("Expires")).toBe(String(clock.now().getTime() / 1000 + 300));
    expect(await signer.privateUrl("zudomart-media-private", "p/1/original.pdf", 60)).toContain("https://signed.test/");
  });
});
