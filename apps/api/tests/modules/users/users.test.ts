import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication } from "../../fixtures/testApplication.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

const address = { fullName: "Ada Obi", phone: "08031234567", line1: "12 Allen Avenue", city: "Ikeja", state: "Lagos" };

describe("profile", () => {
  it("updates the profile and exposes only public fields to other users", async () => {
    const user = await app.registerUser();
    await app.client
      .patch("/api/v1/users/me")
      .auth(user.accessToken)
      .send({ name: "Ada Obi", bio: "Thrift queen", avatarUrl: "https://cdn.example.com/a.png" })
      .expect(200)
      .expectJson({ name: "Ada Obi", bio: "Thrift queen" });
    const publicProfile = await app.client.get(`/api/v1/users/${user.userId}`).expect(200);
    const body = publicProfile.json<Record<string, unknown>>();
    expect(body["name"]).toBe("Ada Obi");
    expect(body).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("birthday");
    await app.client.get(`/api/v1/users/username/${user.username}`).expect(200);
  });

  it("refuses a username that is already taken", async () => {
    const first = await app.registerUser();
    const second = await app.registerUser();
    await app.client.patch("/api/v1/users/me").auth(second.accessToken).send({ username: first.username }).expect(409);
  });

  it("requires authentication for private profile routes", async () => {
    await app.client.get("/api/v1/users/me").expect(401);
    await app.client.get("/api/v1/users/me").auth("not-a-token").expect(401);
  });
});

describe("settings and topics", () => {
  it("merges notification preferences and theme changes", async () => {
    const user = await app.registerUser();
    await app.client
      .patch("/api/v1/users/me/settings")
      .auth(user.accessToken)
      .send({ theme: "dark", notifications: { promotions: true } })
      .expect(200)
      .expectJson({ theme: "dark", notifications: { promotions: true, orders: true } });
  });

  it("requires at least three known topics", async () => {
    const user = await app.registerUser();
    const topics = (await app.client.get("/api/v1/topics").expect(200)).json<{ items: { id: string }[] }>().items;
    expect(topics.length).toBeGreaterThanOrEqual(3);
    const [first, second, third] = topics;
    await app.client.put("/api/v1/users/me/topics").auth(user.accessToken).send({ topicIds: [first?.id, second?.id] }).expect(400);
    await app.client
      .put("/api/v1/users/me/topics")
      .auth(user.accessToken)
      .send({ topicIds: [first?.id, second?.id, "00000000-0000-4000-8000-000000000000"] })
      .expect(422);
    await app.client.put("/api/v1/users/me/topics").auth(user.accessToken).send({ topicIds: [first?.id, second?.id, third?.id] }).expect(200);
    const mine = await app.client.get("/api/v1/users/me/topics").auth(user.accessToken).expect(200);
    expect(mine.json<{ items: unknown[] }>().items).toHaveLength(3);
  });
});

describe("addresses", () => {
  it("stores the phone number encrypted and keeps one default address", async () => {
    const user = await app.registerUser();
    const first = (await app.client.post("/api/v1/users/me/addresses").auth(user.accessToken).send(address).expect(201)).json<{ id: string; phone: string; isDefault: boolean }>();
    expect(first.phone).toBe("+2348031234567");
    expect(first.isDefault).toBe(true);
    const second = (
      await app.client.post("/api/v1/users/me/addresses").auth(user.accessToken).send({ ...address, line1: "3 Broad Street", isDefault: true }).expect(201)
    ).json<{ id: string }>();
    const list = (await app.client.get("/api/v1/users/me/addresses").auth(user.accessToken).expect(200)).json<{ items: { id: string; isDefault: boolean }[] }>().items;
    expect(list.filter((entry) => entry.isDefault).map((entry) => entry.id)).toEqual([second.id]);
    expect(JSON.stringify(list)).not.toContain("phoneEncrypted");
  });

  it("does not let another user read, change or delete an address", async () => {
    const owner = await app.registerUser();
    const intruder = await app.registerUser();
    const created = (await app.client.post("/api/v1/users/me/addresses").auth(owner.accessToken).send(address).expect(201)).json<{ id: string }>();
    await app.client.patch(`/api/v1/users/me/addresses/${created.id}`).auth(intruder.accessToken).send({ city: "Abuja" }).expect(404);
    await app.client.delete(`/api/v1/users/me/addresses/${created.id}`).auth(intruder.accessToken).expect(404);
    const intruderList = (await app.client.get("/api/v1/users/me/addresses").auth(intruder.accessToken).expect(200)).json<{ items: unknown[] }>();
    expect(intruderList.items).toHaveLength(0);
    await app.client.delete(`/api/v1/users/me/addresses/${created.id}`).auth(owner.accessToken).expect(204);
  });
});

describe("deactivation", () => {
  it("deactivates the account, signs out every session and blocks login", async () => {
    const user = await app.registerUser();
    await app.client.post("/api/v1/users/me/deactivate").auth(user.accessToken).expect(204);
    await app.client.get("/api/v1/users/me").auth(user.accessToken).expect(401);
    await app.client.post("/api/v1/auth/login").send({ identifier: user.email, password: user.password }).expect(403);
    await app.client.get(`/api/v1/users/${user.userId}`).expect(404);
  });
});
