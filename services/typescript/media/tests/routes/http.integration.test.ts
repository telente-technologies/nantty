import { createHash, createHmac } from "node:crypto";
import { request as httpRequest } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createMediaHttpApp, defaultBodyLimitBytes, proxiedChunkLimitBytes } from "../../src/httpApp.js";
import type { UploadSessionView } from "../../src/modules/uploads/commands/createUploadSession/createUploadSession.command.js";
import { createHarness } from "../fakes/pipelineHarness.js";

const secret = "test-gateway-identity-secret-0123456789abcdef";
const previous = "older-gateway-identity-secret-0123456789abcdef";
const ownerId = "0190a0b0-0000-7000-8000-000000000001";
const internalToken = "media-internal-test-token";

function signedHeaders(method: string, path: string, key = secret, accountId = ownerId, issuedAt = Math.floor(Date.now() / 1000)): Record<string, string> {
  const headers = { "x-request-id": "media-http-test", "x-nantty-account-id": accountId, "x-nantty-session-id": "session", "x-nantty-age-bracket": "adult" };
  const payload = ["v1", String(issuedAt), method, path, headers["x-request-id"], accountId, "session", "adult", ""].join("\n");
  return { ...headers, "x-nantty-identity-signature": `t=${issuedAt},v1=${createHmac("sha256", key).update(payload).digest("hex")}` };
}

async function startServer(allowProxiedChunks: boolean) {
  const harness = createHarness({ config: { allowProxiedChunks, internalToken, gatewayIdentitySecrets: [secret, previous], rabbitMqUrl: "", ffmpeg: { mode: "disabled", ffmpegPath: "ffmpeg", ffprobePath: "ffprobe", fpcalcPath: "fpcalc", timeoutMs: 1000, maximumHeight: 720 } } });
  const app = await createMediaHttpApp(harness.context);
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  if (address === null || typeof address === "string") throw new Error("Missing HTTP address");
  return { app, harness, baseUrl: `http://127.0.0.1:${address.port}` };
}

// Send an oversized declared length without allocating a 65 MiB test buffer.
async function oversizedRequest(baseUrl: string, length: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const path = "/api/v1/media/uploads";
    const request = httpRequest(`${baseUrl}${path}`, { method: "POST", agent: false, headers: { ...signedHeaders("POST", path), "content-type": "application/json", "content-length": length } }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode ?? 0));
    });
    request.setTimeout(5000, () => request.destroy(new Error("HTTP body-limit test timed out")));
    request.on("error", reject);
    request.end("{");
  });
}

describe("Media over real HTTP", () => {
  let server: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => { server = await startServer(true); });
  afterAll(async () => { await server?.app.close(); });

  it("serves health, readiness, HEAD and method negotiation on the socket", async () => {
    const health = await fetch(`${server.baseUrl}/healthz`);
    expect(await health.json()).toEqual({ status: "up", service: "media" });
    expect((await fetch(`${server.baseUrl}/readyz`)).status).toBe(200);
    expect(await (await fetch(`${server.baseUrl}/healthz`, { method: "HEAD" })).text()).toBe("");
    const options = await fetch(`${server.baseUrl}/api/v1/media/uploads/${ownerId}`, { method: "OPTIONS" });
    expect(options.status).toBe(204);
    expect(options.headers.get("allow")).toContain("GET");
    expect((await fetch(`${server.baseUrl}/api/v1/media/uploads/${ownerId}`, { method: "PATCH" })).status).toBe(405);
    expect((await fetch(`${server.baseUrl}/unknown`)).status).toBe(404);
  });

  it("enforces gateway signatures, secret rotation and required user identity", async () => {
    const path = `/api/v1/media/uploads/${ownerId}`;
    expect((await fetch(`${server.baseUrl}${path}`)).status).toBe(401);
    expect((await fetch(`${server.baseUrl}${path}`, { headers: { "x-nantty-account-id": ownerId } })).status).toBe(401);
    expect((await fetch(`${server.baseUrl}${path}`, { headers: signedHeaders("DELETE", path) })).status).toBe(401);
    expect((await fetch(`${server.baseUrl}${path}`, { headers: signedHeaders("GET", path, secret, ownerId, Math.floor(Date.now() / 1000) - 61) })).status).toBe(401);
    // Auth succeeds with the previous secret; the absent session returns a domain 404.
    expect((await fetch(`${server.baseUrl}${path}`, { headers: signedHeaders("GET", path, previous) })).status).toBe(404);
  });

  it("keeps internal-token checks and JSON/parameter validation", async () => {
    const path = "/internal/v1/media/invalid-id";
    expect((await fetch(`${server.baseUrl}${path}`)).status).toBe(403);
    const invalidId = await fetch(`${server.baseUrl}${path}`, { headers: { "x-internal-token": internalToken } });
    expect(invalidId.status).toBe(400);
    expect(await invalidId.json()).toMatchObject({ code: "VALIDATION_FAILED" });
    const response = await fetch(`${server.baseUrl}/api/v1/media/uploads`, { method: "POST", headers: { ...signedHeaders("POST", "/api/v1/media/uploads"), "content-type": "application/json" }, body: "{invalid" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_JSON" });
  });

  it("uploads original binary bytes above 1 MiB, verifies checksums and rejects other owners", async () => {
    const createPath = "/api/v1/media/uploads";
    const created = await fetch(`${server.baseUrl}${createPath}`, { method: "POST", headers: { ...signedHeaders("POST", createPath), "content-type": "application/json" }, body: JSON.stringify({ fileName: "video.mp4", mimeType: "video/mp4", purpose: "post", sizeBytes: 9 * 1024 * 1024 + 3 }) });
    expect(created.status).toBe(201);
    const session = await created.json() as UploadSessionView;
    const path = `/api/v1/media/uploads/${session.uploadId}/chunks/1`;
    const bytes = Buffer.alloc(defaultBodyLimitBytes + 3, 0xff);
    bytes.set([0, 0x80, 0xfe, 0x7b], 0);
    const headers = { ...signedHeaders("PUT", path), "content-type": "application/octet-stream", "x-chunk-sha256": createHash("sha256").update(bytes).digest("hex") };
    const uploaded = await fetch(`${server.baseUrl}${path}`, { method: "PUT", headers, body: bytes });
    expect(uploaded.status).toBe(200);
    expect(await uploaded.json()).toEqual({ uploadedChunks: [1] });
    expect([...server.harness.storage.multipart.values()].some((parts) => parts.get(2)?.equals(bytes))).toBe(true);
    const jsonTypedChunk = await fetch(`${server.baseUrl}${path}`, { method: "PUT", headers: { ...headers, "content-type": "application/json" }, body: bytes });
    expect(jsonTypedChunk.status).toBe(200);
    const mismatched = await fetch(`${server.baseUrl}${path}`, { method: "PUT", headers: { ...headers, "x-chunk-sha256": "0".repeat(64) }, body: bytes });
    expect(mismatched.status).toBe(422);
    expect(await mismatched.json()).toMatchObject({ code: "CHUNK_CHECKSUM_MISMATCH" });
    const wrongSize = await fetch(`${server.baseUrl}${path}`, { method: "PUT", headers, body: bytes.subarray(1) });
    expect(wrongSize.status).toBe(422);
    const otherOwner = await fetch(`${server.baseUrl}${path}`, { method: "PUT", headers: { ...headers, ...signedHeaders("PUT", path, secret, "0190a0b0-0000-7000-8000-000000000002") }, body: bytes });
    expect(otherOwner.status).toBe(404);
  });

  it("enforces the 65 MiB limit when proxying is enabled", async () => {
    expect(await oversizedRequest(server.baseUrl, proxiedChunkLimitBytes + 1)).toBe(413);
  });

  it("enforces the 1 MiB default and keeps proxied chunks disabled", async () => {
    const strict = await startServer(false);
    try {
      expect(await oversizedRequest(strict.baseUrl, defaultBodyLimitBytes + 1)).toBe(413);
      const path = `/api/v1/media/uploads/${ownerId}/chunks/0`;
      const response = await fetch(`${strict.baseUrl}${path}`, { method: "PUT", headers: { ...signedHeaders("PUT", path), "content-type": "application/octet-stream" }, body: Buffer.from([0, 0xff]) });
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "PROXIED_CHUNKS_DISABLED" });
    } finally { await strict.app.close(); }
  });
});
