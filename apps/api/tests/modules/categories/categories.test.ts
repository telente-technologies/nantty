import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication } from "../../fixtures/testApplication.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

type CategoryList = readonly { readonly id: string; readonly slug: string; readonly name: string }[];

describe("categories", () => {
  it("lists the default categories to anyone", async () => {
    const response = await app.client.get("/api/v1/categories").expect(200);
    const slugs = response.json<CategoryList>().map((category) => category.slug);
    expect(slugs).toEqual(expect.arrayContaining(["fashion", "kids", "beauty-personal-care", "appliances"]));
  });

  it("lets admins manage categories and refuses everyone else", async () => {
    const buyer = await app.registerUser();
    const admin = await app.registerAdmin();
    await app.client.post("/api/v1/categories").send({ name: "Toys" }).expect(401);
    await app.client.post("/api/v1/categories").auth(buyer.accessToken).send({ name: "Toys" }).expect(403);

    const created = await app.client.post("/api/v1/categories").auth(admin.accessToken).send({ name: "Toys & Games", sortOrder: 99 }).expect(201);
    const { id, slug } = created.json<{ id: string; slug: string }>();
    expect(slug).toBe("toys-games");
    await app.client.post("/api/v1/categories").auth(admin.accessToken).send({ name: "Toys & Games" }).expect(409);
    await app.client.patch(`/api/v1/categories/${id}`).auth(admin.accessToken).send({ name: "Toys" }).expect(200).expectJson({ name: "Toys" });
    await app.client.get(`/api/v1/categories/${id}`).expect(200).expectJson({ name: "Toys" });
    await app.client.delete(`/api/v1/categories/${id}`).auth(admin.accessToken).expect(204);
    await app.client.get(`/api/v1/categories/${id}`).expect(404);
  });
});
