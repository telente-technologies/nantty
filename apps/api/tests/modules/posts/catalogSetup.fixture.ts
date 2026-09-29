import type { SignedInUser, TestApplication } from "../../fixtures/testApplication.fixture.js";

export async function createStoreForSeller(app: TestApplication, seller: SignedInUser, name = "Ada Styles"): Promise<string> {
  const created = await app.client.post("/api/v1/stores").auth(seller.accessToken).send({ name }).expect(201);
  return created.json<{ id: string }>().id;
}

export async function createProductInStore(
  app: TestApplication,
  seller: SignedInUser,
  storeId: string,
  options: { readonly publish?: boolean; readonly title?: string } = {},
): Promise<string> {
  const created = await app.client
    .post(`/api/v1/seller/products?storeId=${storeId}`)
    .auth(seller.accessToken)
    .send({ title: options.title ?? "Ankara Dress", price: 1_500_000, stock: 5 })
    .expect(201);
  const productId = created.json<{ id: string }>().id;
  if (options.publish ?? true) {
    await app.client.post(`/api/v1/seller/products/${productId}/publish`).auth(seller.accessToken).expect(200);
  }
  return productId;
}
