import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication } from "../../fixtures/testApplication.fixture.js";
import { createProductInStore, createStoreForSeller } from "./catalogSetup.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

describe("live sessions", () => {
  it("runs a session from start to end with viewers, comments and pinned products", async () => {
    const host = await app.registerSeller();
    const storeId = await createStoreForSeller(app, host, "Live Store");
    const productId = await createProductInStore(app, host, storeId);
    const viewer = await app.registerUser();

    const session = (await app.client.post("/api/v1/lives").auth(host.accessToken).send({ title: "Friday flash sale", storeId }).expect(201)).json<{ id: string }>();
    const listed = await app.client.get("/api/v1/lives").expect(200);
    expect(listed.json<{ data: { id: string }[] }>().data.map((item) => item.id)).toContain(session.id);

    await app.client.post(`/api/v1/lives/${session.id}/join`).auth(viewer.accessToken).expect(200).expectJson({ viewerCount: 1 });
    await app.client.post(`/api/v1/lives/${session.id}/join`).auth(viewer.accessToken).expect(200).expectJson({ viewerCount: 1 });
    await app.client.post(`/api/v1/lives/${session.id}/comments`).auth(viewer.accessToken).send({ text: "How much?" }).expect(201);
    const comments = await app.client.get(`/api/v1/lives/${session.id}/comments`).expect(200);
    expect(comments.json<{ data: { text: string }[] }>().data.map((item) => item.text)).toEqual(["How much?"]);

    await app.client.post(`/api/v1/lives/${session.id}/products`).auth(viewer.accessToken).send({ productId, pin: true }).expect(403);
    const pinned = await app.client.post(`/api/v1/lives/${session.id}/products`).auth(host.accessToken).send({ productId, pin: true }).expect(200);
    expect(pinned.json<{ pinnedProduct: { id: string } | null }>().pinnedProduct?.id).toBe(productId);

    await app.client.post(`/api/v1/lives/${session.id}/leave`).auth(viewer.accessToken).expect(200).expectJson({ viewerCount: 0 });
    await app.client.post(`/api/v1/lives/${session.id}/end`).auth(viewer.accessToken).expect(403);
    await app.client.post(`/api/v1/lives/${session.id}/end`).auth(host.accessToken).expect(200).expectJson({ status: "ended" });
    await app.client.post(`/api/v1/lives/${session.id}/join`).auth(viewer.accessToken).expect(422);
    await app.client.post(`/api/v1/lives/${session.id}/comments`).auth(viewer.accessToken).send({ text: "late" }).expect(422);
  });

  it("requires store membership to go live for a store", async () => {
    const seller = await app.registerSeller();
    const storeId = await createStoreForSeller(app, seller, "Private Live Store");
    const outsider = await app.registerUser();
    await app.client.post("/api/v1/lives").auth(outsider.accessToken).send({ title: "Hijack", storeId }).expect(403);
    await app.client.post("/api/v1/lives").auth(outsider.accessToken).send({ title: "Just me" }).expect(201);
  });
});
