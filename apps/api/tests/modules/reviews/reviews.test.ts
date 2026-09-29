import { afterAll, describe, it } from "vitest";

import { createTestApplication } from "../../fixtures/testApplication.fixture.js";
import { createProductInStore, createStoreForSeller } from "../posts/catalogSetup.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

describe("product reviews over HTTP", () => {
  it("rejects reviews from buyers who have not received the product", async () => {
    const seller = await app.registerSeller();
    const storeId = await createStoreForSeller(app, seller, "Review Store");
    const productId = await createProductInStore(app, seller, storeId);
    const buyer = await app.registerUser();
    await app.client
      .post(`/api/v1/products/${productId}/reviews`)
      .auth(buyer.accessToken)
      .send({ orderId: "22222222-2222-4222-8222-222222222222", rating: 5, text: "Great" })
      .expect(403);
    await app.client.post(`/api/v1/products/${productId}/reviews`).auth(buyer.accessToken).send({ orderId: "22222222-2222-4222-8222-222222222222", rating: 6 }).expect(400);
    await app.client.post(`/api/v1/products/${productId}/reviews`).send({ orderId: "22222222-2222-4222-8222-222222222222", rating: 5 }).expect(401);
  });

  it("returns an empty rating summary and review lists for a new product", async () => {
    const seller = await app.registerSeller();
    const storeId = await createStoreForSeller(app, seller, "Quiet Store");
    const productId = await createProductInStore(app, seller, storeId);
    await app.client.get(`/api/v1/products/${productId}/rating-summary`).expect(200).expectJson({ average: 0, count: 0 });
    await app.client.get(`/api/v1/products/${productId}/reviews`).expect(200).expectJson({ items: [], nextCursor: null });
    await app.client.get(`/api/v1/stores/${storeId}/reviews`).expect(200).expectJson({ items: [], nextCursor: null });
  });

  it("lets only sellers reply to reviews", async () => {
    const buyer = await app.registerUser();
    await app.client.post("/api/v1/reviews/33333333-3333-4333-8333-333333333333/reply").auth(buyer.accessToken).send({ reply: "Hi" }).expect(403);
  });
});
