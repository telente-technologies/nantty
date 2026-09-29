import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication } from "../../fixtures/testApplication.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

describe("search", () => {
  it("finds published products, active stores and people", async () => {
    const seller = await app.registerUser({ username: "zebrashopper", roles: ["seller"] });
    const store = await app.client.post("/api/v1/stores").auth(seller.accessToken).send({ name: "Zebra Crossing Wears" }).expect(201);
    const storeId = store.json<{ id: string }>().id;
    const hidden = await app.client.post(`/api/v1/stores/${storeId}/products`).auth(seller.accessToken).send({ title: "Zebra Draft Scarf", price: 100 }).expect(201);
    const visible = await app.client.post(`/api/v1/stores/${storeId}/products`).auth(seller.accessToken).send({ title: "Zebra Print Shirt", price: 100, stock: 1 }).expect(201);
    await app.client.post(`/api/v1/stores/${storeId}/products/${visible.json<{ id: string }>().id}/publish`).auth(seller.accessToken).expect(200);

    const all = await app.client.get("/api/v1/search").query({ q: "zebra" }).expect(200);
    const results = all.json<{ products: { id: string }[]; stores: { id: string }[]; users: { username: string }[] }>();
    expect(results.products.map((product) => product.id)).toEqual([visible.json<{ id: string }>().id]);
    expect(results.products.map((product) => product.id)).not.toContain(hidden.json<{ id: string }>().id);
    expect(results.stores.map((item) => item.id)).toEqual([storeId]);
    expect(results.users.map((user) => user.username)).toEqual(["zebrashopper"]);

    const storesOnly = await app.client.get("/api/v1/search").query({ q: "ZEBRA", type: "stores" }).expect(200);
    expect(Object.keys(storesOnly.json<Record<string, unknown>>()).sort()).toEqual(["query", "stores"]);
    await app.client.get("/api/v1/search").expect(400);
  });
});
