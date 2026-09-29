import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication } from "../../fixtures/testApplication.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

interface UploadInstructions {
  readonly mediaId: string;
  readonly uploadUrl: string;
  readonly maxBytes: number;
}

async function requestUpload(accessToken: string, size = PNG_BYTES.byteLength): Promise<UploadInstructions> {
  const response = await app.client.post("/api/v1/media/uploads").auth(accessToken).send({ purpose: "avatar", contentType: "image/png", size }).expect(201);
  return response.json<UploadInstructions>();
}

describe("media uploads", () => {
  it("uploads through a signed URL once and serves the file", async () => {
    const user = await app.registerUser();
    const upload = await requestUpload(user.accessToken);
    await app.client.put(upload.uploadUrl).set("content-type", "image/png").send(PNG_BYTES).expect(200).expectJson({ status: "uploaded", size: PNG_BYTES.byteLength });
    await app.client.put(upload.uploadUrl).set("content-type", "image/png").send(PNG_BYTES).expect(409);
    const file = await app.client.get(`/api/v1/media/${upload.mediaId}`).expect(200).expect("content-type", /image\/png/);
    expect([...file.bytes]).toEqual([...PNG_BYTES]);
  });

  it("rejects tampered and expired signatures", async () => {
    const user = await app.registerUser();
    const upload = await requestUpload(user.accessToken);
    const tampered = upload.uploadUrl.replace(/signature=([a-f0-9])/, (_match, first: string) => `signature=${first === "a" ? "b" : "a"}`);
    await app.client.put(tampered).set("content-type", "image/png").send(PNG_BYTES).expect(403);
    const otherId = await requestUpload(user.accessToken);
    await app.client.put(upload.uploadUrl.replace(upload.mediaId, otherId.mediaId)).set("content-type", "image/png").send(PNG_BYTES).expect(403);
    app.clock.advanceBySeconds(901);
    await app.client.put(upload.uploadUrl).set("content-type", "image/png").send(PNG_BYTES).expect(403);
  });

  it("checks the declared type, the file content and the size", async () => {
    const user = await app.registerUser();
    await app.client.post("/api/v1/media/uploads").auth(user.accessToken).send({ purpose: "avatar", contentType: "video/mp4", size: 10 }).expect(422);
    await app.client.post("/api/v1/media/uploads").auth(user.accessToken).send({ purpose: "avatar", contentType: "image/png", size: 2 * 1024 * 1024 }).expect(422);
    await app.client.post("/api/v1/media/uploads").auth(user.accessToken).send({ purpose: "avatar", contentType: "text/html", size: 10 }).expect(400);

    const wrongContent = await requestUpload(user.accessToken);
    await app.client.put(wrongContent.uploadUrl).set("content-type", "image/png").send(new TextEncoder().encode("<html>not a png")).expect(422);
    await app.client.put(wrongContent.uploadUrl).set("content-type", "image/jpeg").send(PNG_BYTES).expect(422);

    const tooSmallAllowance = await requestUpload(user.accessToken, 4);
    await app.client.put(tooSmallAllowance.uploadUrl).set("content-type", "image/png").send(PNG_BYTES).expect(422);
  });

  it("lets only the owner delete a file", async () => {
    const owner = await app.registerUser();
    const stranger = await app.registerUser();
    const upload = await requestUpload(owner.accessToken);
    await app.client.put(upload.uploadUrl).set("content-type", "image/png").send(PNG_BYTES).expect(200);
    await app.client.delete(`/api/v1/media/${upload.mediaId}`).auth(stranger.accessToken).expect(404);
    await app.client.delete(`/api/v1/media/${upload.mediaId}`).auth(owner.accessToken).expect(204);
    await app.client.get(`/api/v1/media/${upload.mediaId}`).expect(404);
  });
});
