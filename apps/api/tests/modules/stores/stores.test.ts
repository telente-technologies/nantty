import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication, type SignedInUser } from "../../fixtures/testApplication.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

async function signInAgain(user: SignedInUser): Promise<string> {
  const login = await app.client.post("/api/v1/auth/login").send({ identifier: user.email, password: user.password }).expect(200);
  return login.json<{ accessToken: string }>().accessToken;
}

async function createStoreFor(seller: SignedInUser, name = "Ada Fabrics"): Promise<string> {
  const created = await app.client.post("/api/v1/stores").auth(seller.accessToken).send({ name, currency: "NGN", shippingFee: 150_000, discountBps: 1_000 }).expect(201);
  return created.json<{ id: string }>().id;
}

describe("seller applications", () => {
  it("approves an application, opens the store and grants the seller role", async () => {
    const applicant = await app.registerUser();
    const admin = await app.registerAdmin();
    const submitted = await app.client
      .post("/api/v1/seller/applications")
      .auth(applicant.accessToken)
      .send({ storeName: "Lagos Kicks", phone: "08012345678", description: "Sneakers" })
      .expect(201);
    await app.client.patch("/api/v1/users/me/preferences").auth(applicant.accessToken).send({ countryCode: "GB" }).expect(200);
    const applicationId = submitted.json<{ id: string; phone: string }>().id;
    expect(submitted.json<{ phone: string }>().phone).toBe("+2348012345678");
    await app.client.post("/api/v1/seller/applications").auth(applicant.accessToken).send({ storeName: "Again", phone: "08012345678" }).expect(409);

    await app.client.get("/api/v1/admin/seller-applications").auth(applicant.accessToken).expect(403);
    const pending = await app.client.get("/api/v1/admin/seller-applications").query({ status: "pending" }).auth(admin.accessToken).expect(200);
    expect(pending.json<{ items: { id: string }[] }>().items.map((item) => item.id)).toContain(applicationId);

    await app.client.post(`/api/v1/admin/seller-applications/${applicationId}/review`).auth(admin.accessToken).send({ decision: "approve" }).expect(200).expectJson({ status: "approved" });
    await app.client.post(`/api/v1/admin/seller-applications/${applicationId}/review`).auth(admin.accessToken).send({ decision: "reject" }).expect(409);

    const sellerToken = await signInAgain(applicant);
    const mine = await app.client.get("/api/v1/stores/mine").auth(sellerToken).expect(200);
    expect(mine.json<{ items: { name: string; currency: string }[] }>().items).toMatchObject([{ name: "Lagos Kicks", currency: "GBP" }]);

    const audit = await app.client.get("/api/v1/admin/audit-events").query({ entityId: applicationId }).auth(admin.accessToken).expect(200);
    expect(audit.json<{ items: { action: string }[] }>().items[0]?.action).toBe("stores.seller_application_approved");
  });
});

describe("stores", () => {
  it("lets only sellers create stores and shows public details", async () => {
    const buyer = await app.registerUser();
    const seller = await app.registerSeller();
    await app.client.post("/api/v1/stores").auth(buyer.accessToken).send({ name: "Nope" }).expect(403);
    const storeId = await createStoreFor(seller);
    const detail = await app.client.get(`/api/v1/stores/${storeId}`).set("x-client-region", "NG").expect(200);
    expect(detail.json()).toMatchObject({
      name: "Ada Fabrics", currency: "NGN", shippingFee: { amountMinor: 150_000, currency: "NGN" }, discountBps: 1_000, productCount: 0,
    });
    const british = await app.client.get(`/api/v1/stores/${storeId}`).set("x-client-region", "GB").expect(200);
    expect(british.json()).toMatchObject({ currency: "NGN", shippingFee: { amountMinor: 75, currency: "GBP" } });
    const slug = detail.json<{ slug: string }>().slug;
    await app.client.get(`/api/v1/stores/slug/${slug}`).expect(200).expectJson({ id: storeId });
  });

  it("checks store membership and roles on the server", async () => {
    const owner = await app.registerSeller();
    const outsider = await app.registerSeller();
    const helper = await app.registerUser();
    const storeId = await createStoreFor(owner, "Owner Store");

    await app.client.patch(`/api/v1/stores/${storeId}`).auth(outsider.accessToken).send({ name: "Hijacked" }).expect(403);
    await app.client.get(`/api/v1/stores/${storeId}/members`).auth(outsider.accessToken).expect(403);
    await app.client.post(`/api/v1/stores/${storeId}/members`).auth(outsider.accessToken).send({ userId: helper.userId, role: "manager" }).expect(403);

    await app.client.post(`/api/v1/stores/${storeId}/members`).auth(owner.accessToken).send({ userId: helper.userId, role: "staff" }).expect(201);
    await app.client.post(`/api/v1/stores/${storeId}/members`).auth(owner.accessToken).send({ userId: helper.userId, role: "staff" }).expect(409);
    const members = await app.client.get(`/api/v1/stores/${storeId}/members`).auth(owner.accessToken).expect(200);
    expect(members.json<{ items: unknown[] }>().items).toHaveLength(2);

    await app.client.patch(`/api/v1/stores/${storeId}`).auth(owner.accessToken).send({ name: "Renamed Store" }).expect(200).expectJson({ name: "Renamed Store" });
    await app.client.delete(`/api/v1/stores/${storeId}/members/${owner.userId}`).auth(owner.accessToken).expect(422);
    await app.client.delete(`/api/v1/stores/${storeId}/members/${helper.userId}`).auth(owner.accessToken).expect(204);
  });

  it("limits sellers to five stores", async () => {
    const seller = await app.registerSeller();
    for (let index = 0; index < 5; index += 1) await createStoreFor(seller, `Store ${index}`);
    await app.client.post("/api/v1/stores").auth(seller.accessToken).send({ name: "Sixth" }).expect(422);
  });

  it("hides suspended stores and audit-logs the suspension", async () => {
    const seller = await app.registerSeller();
    const admin = await app.registerAdmin();
    const storeId = await createStoreFor(seller, "Soon Suspended");
    await app.client.post(`/api/v1/admin/stores/${storeId}/status`).auth(seller.accessToken).send({ status: "suspended" }).expect(403);
    await app.client.post(`/api/v1/admin/stores/${storeId}/status`).auth(admin.accessToken).send({ status: "suspended", reason: "fraud" }).expect(200);
    await app.client.get(`/api/v1/stores/${storeId}`).expect(404);
    const audit = await app.client.get("/api/v1/admin/audit-events").query({ entityId: storeId }).auth(admin.accessToken).expect(200);
    expect(audit.json<{ items: { action: string }[] }>().items.map((event) => event.action)).toContain("stores.suspended");
    await app.client.post(`/api/v1/admin/stores/${storeId}/status`).auth(admin.accessToken).send({ status: "active" }).expect(200);
    await app.client.get(`/api/v1/stores/${storeId}`).expect(200);
  });

  it("lists featured stores", async () => {
    const seller = await app.registerSeller();
    const admin = await app.registerAdmin();
    const storeId = await createStoreFor(seller, "Featured Brand");
    await app.client.post(`/api/v1/admin/stores/${storeId}/featured`).auth(admin.accessToken).send({ featured: true }).expect(200);
    const featured = await app.client.get("/api/v1/stores").query({ featured: "true" }).expect(200);
    expect(featured.json<{ items: { id: string }[] }>().items.map((store) => store.id)).toEqual([storeId]);
  });

  it("picks the store currency from the body or the creator's region and locks it once products exist", async () => {
    const seller = await app.registerSeller();
    const ghana = await app.client.post("/api/v1/stores").auth(seller.accessToken).set("x-client-region", "GH").send({ name: "Accra Store" }).expect(201);
    expect(ghana.json<{ currency: string }>().currency).toBe("GHS");
    await app.client.post("/api/v1/stores").auth(seller.accessToken).send({ name: "Bad Currency", currency: "XYZ" }).expect(400);
    const storeId = ghana.json<{ id: string }>().id;
    await app.client.patch(`/api/v1/stores/${storeId}`).auth(seller.accessToken).send({ currency: "NGN" }).expect(200).expectJson({ currency: "NGN" });
    await app.client.post(`/api/v1/seller/products?storeId=${storeId}`).auth(seller.accessToken).send({ title: "Kente", price: 500_000 }).expect(201).expectJson({ price: { currency: "NGN" } });
    await app.client.patch(`/api/v1/stores/${storeId}`).auth(seller.accessToken).send({ currency: "GBP" }).expect(422);
  });
});
