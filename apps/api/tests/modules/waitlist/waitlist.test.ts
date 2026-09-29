import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication } from "../../fixtures/testApplication.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

describe("waitlist", () => {
  it("accepts the same email twice without revealing it already exists", async () => {
    const first = await app.client.post("/api/v1/waitlist").send({ email: "Early@Example.com", role: "seller" }).expect(202);
    const second = await app.client.post("/api/v1/waitlist").send({ email: "early@example.com" }).expect(202);
    expect(second.json()).toEqual(first.json());
    await app.client.post("/api/v1/waitlist").send({ email: "not-an-email" }).expect(400);
  });

  it("lets only admins list and count entries", async () => {
    const buyer = await app.registerUser();
    const admin = await app.registerAdmin();
    await app.client.post("/api/v1/waitlist").send({ email: "second@example.com", name: "Second" }).expect(202);
    await app.client.get("/api/v1/admin/waitlist").expect(401);
    await app.client.get("/api/v1/admin/waitlist").auth(buyer.accessToken).expect(403);
    await app.client.get("/api/v1/admin/waitlist/count").auth(admin.accessToken).expect(200).expectJson({ total: 2 });
    const firstPage = await app.client.get("/api/v1/admin/waitlist").query({ limit: 1 }).auth(admin.accessToken).expect(200);
    const page = firstPage.json<{ data: { email: string; role: string }[]; nextCursor: string | null }>();
    expect(page.data).toHaveLength(1);
    expect(page.nextCursor).not.toBeNull();
    const secondPage = await app.client.get("/api/v1/admin/waitlist").query({ limit: 1, cursor: page.nextCursor ?? "" }).auth(admin.accessToken).expect(200);
    const entries = [...page.data, ...secondPage.json<{ data: { email: string; role: string }[] }>().data];
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: "early@example.com", role: "seller" }),
        expect.objectContaining({ email: "second@example.com", role: "buyer" }),
      ]),
    );
  });
});
