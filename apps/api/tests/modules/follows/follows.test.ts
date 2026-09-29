import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication } from "../../fixtures/testApplication.fixture.js";
import { createStoreForSeller } from "../posts/catalogSetup.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

interface FollowStatusBody {
  readonly following: boolean;
  readonly followedBy: boolean;
  readonly blocked: boolean;
  readonly followersCount: number;
  readonly followingCount: number;
}

describe("following users", () => {
  it("follows and unfollows a user idempotently and reports counts", async () => {
    const ada = await app.registerUser();
    const bola = await app.registerUser();
    await app.client.post(`/api/v1/users/${bola.userId}/follow`).auth(ada.accessToken).expect(200).expectJson({ following: true, followersCount: 1 });
    await app.client.post(`/api/v1/users/${bola.userId}/follow`).auth(ada.accessToken).expect(200).expectJson({ followersCount: 1 });
    const status = await app.client.get(`/api/v1/users/${ada.userId}/follow-status`).auth(bola.accessToken).expect(200);
    expect(status.json<FollowStatusBody>()).toMatchObject({ following: false, followedBy: true, followingCount: 1 });

    const followers = await app.client.get(`/api/v1/users/${bola.userId}/followers`).expect(200);
    expect(followers.json<{ data: { id: string }[] }>().data.map((user) => user.id)).toEqual([ada.userId]);
    const following = await app.client.get(`/api/v1/users/${ada.userId}/following`).expect(200);
    expect(following.json<{ data: { id: string }[] }>().data.map((user) => user.id)).toEqual([bola.userId]);

    await app.client.delete(`/api/v1/users/${bola.userId}/follow`).auth(ada.accessToken).expect(200).expectJson({ following: false, followersCount: 0 });
  });

  it("rejects following yourself, unknown users and anonymous callers", async () => {
    const ada = await app.registerUser();
    await app.client.post(`/api/v1/users/${ada.userId}/follow`).auth(ada.accessToken).expect(422);
    await app.client.post("/api/v1/users/00000000-0000-4000-8000-000000000000/follow").auth(ada.accessToken).expect(404);
    await app.client.post(`/api/v1/users/${ada.userId}/follow`).expect(401);
  });
});

describe("blocking users", () => {
  it("removes follows both ways, prevents new follows and lists blocked users", async () => {
    const ada = await app.registerUser();
    const bola = await app.registerUser();
    await app.client.post(`/api/v1/users/${bola.userId}/follow`).auth(ada.accessToken).expect(200);
    await app.client.post(`/api/v1/users/${ada.userId}/follow`).auth(bola.accessToken).expect(200);

    await app.client.post(`/api/v1/users/${bola.userId}/block`).auth(ada.accessToken).expect(204);
    await app.client.get(`/api/v1/users/${bola.userId}/follow-status`).auth(ada.accessToken).expect(200).expectJson({ following: false, followedBy: false, blocked: true });
    await app.client.post(`/api/v1/users/${ada.userId}/follow`).auth(bola.accessToken).expect(403);
    await app.client.post(`/api/v1/users/${bola.userId}/follow`).auth(ada.accessToken).expect(403);

    const blocked = await app.client.get("/api/v1/users/me/blocked").auth(ada.accessToken).expect(200);
    expect(blocked.json<{ data: { id: string }[] }>().data.map((user) => user.id)).toEqual([bola.userId]);

    await app.client.delete(`/api/v1/users/${bola.userId}/block`).auth(ada.accessToken).expect(204);
    await app.client.post(`/api/v1/users/${bola.userId}/follow`).auth(ada.accessToken).expect(200);
  });
});

describe("following stores", () => {
  it("follows a store and lists it under following?type=store", async () => {
    const seller = await app.registerSeller();
    const storeId = await createStoreForSeller(app, seller, "Follow Me Store");
    const buyer = await app.registerUser();
    await app.client.post(`/api/v1/stores/${storeId}/follow`).auth(buyer.accessToken).expect(200).expectJson({ following: true, followersCount: 1 });
    const following = await app.client.get(`/api/v1/users/${buyer.userId}/following`).query({ type: "store" }).expect(200);
    expect(following.json<{ data: { id: string }[] }>().data.map((store) => store.id)).toEqual([storeId]);
    expect(await app.dependencies.ports.socialGraph.listFollowedStoreIds(buyer.userId)).toEqual([storeId]);
  });
});
