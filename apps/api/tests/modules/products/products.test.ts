import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication, type SignedInUser } from "../../fixtures/testApplication.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

interface CreatedProduct {
  readonly id: string;
  readonly status: string;
  readonly variants: readonly { readonly id: string; readonly stock: number; readonly price: { readonly amountMinor: number; readonly currency: string } }[];
}

async function createSellerWithStore(): Promise<{ seller: SignedInUser; storeId: string }> {
  const seller = await app.registerSeller();
  const store = await app.client.post("/api/v1/stores").auth(seller.accessToken).send({ name: "Product Store", currency: "NGN", shippingFee: 150_000 }).expect(201);
  return { seller, storeId: store.json<{ id: string }>().id };
}

async function createProduct(seller: SignedInUser, storeId: string, body: Record<string, unknown>): Promise<CreatedProduct> {
  const created = await app.client.post(`/api/v1/seller/products?storeId=${storeId}`).auth(seller.accessToken).send(body).expect(201);
  return created.json<CreatedProduct>();
}

describe("products", () => {
  it("creates a draft with a default variant and only shows it publicly once published", async () => {
    const { seller, storeId } = await createSellerWithStore();
    const product = await createProduct(seller, storeId, { title: "Ankara Dress", price: 1_500_000, stock: 12 });
    expect(product.status).toBe("draft");
    expect(product.variants).toHaveLength(1);
    expect(product.variants[0]).toMatchObject({ price: { amountMinor: 1_500_000, currency: "NGN" }, stock: 12 });

    await app.client.get(`/api/v1/products/${product.id}`).expect(404);
    await app.client.post(`/api/v1/seller/products/${product.id}/publish`).auth(seller.accessToken).expect(200);
    const detail = await app.client.get(`/api/v1/products/${product.id}`).set("x-client-region", "NG").expect(200);
    expect(detail.json()).toMatchObject({
      title: "Ankara Dress", stockLabel: "12 in stock", totalStock: 12, storeCurrency: "NGN",
      price: { amountMinor: 1_500_000, currency: "NGN" }, store: { id: storeId, shippingFee: { amountMinor: 150_000, currency: "NGN" } },
    });

    const listed = await app.client.get("/api/v1/products").query({ storeId }).expect(200);
    expect(listed.json<{ data: { id: string }[] }>().data.map((item) => item.id)).toEqual([product.id]);
  });

  it("refuses product changes from non-members and buyers", async () => {
    const { storeId } = await createSellerWithStore();
    const otherSeller = await app.registerSeller();
    const buyer = await app.registerUser();
    await app.client.post(`/api/v1/seller/products?storeId=${storeId}`).auth(otherSeller.accessToken).send({ title: "Fake", price: 100 }).expect(403);
    await app.client.post(`/api/v1/seller/products?storeId=${storeId}`).auth(buyer.accessToken).send({ title: "Fake", price: 100 }).expect(403);
    await app.client.get(`/api/v1/seller/inventory?storeId=${storeId}`).auth(otherSeller.accessToken).expect(403);
  });

  it("manages variants and inventory without letting stock go negative", async () => {
    const { seller, storeId } = await createSellerWithStore();
    const product = await createProduct(seller, storeId, {
      title: "Sneakers", price: 2_000_000, variants: [{ size: "42", color: "black", stock: 3 }, { size: "43", color: "white", stock: 1, price: 2_100_000 }],
    });
    const base = `/api/v1/seller/products/${product.id}`;
    const [first] = product.variants;
    await app.client.post(`${base}/variants`).auth(seller.accessToken).send({ size: "44", stock: 5 }).expect(201);
    await app.client.patch(`${base}/variants/${first?.id ?? ""}`).auth(seller.accessToken).send({ price: 1_900_000 }).expect(200).expectJson({ price: { amountMinor: 1_900_000, currency: "NGN" } });
    await app.client.post(`${base}/variants/${first?.id ?? ""}/inventory`).auth(seller.accessToken).send({ delta: -4 }).expect(422);
    await app.client.post(`${base}/variants/${first?.id ?? ""}/inventory`).auth(seller.accessToken).send({ delta: 7 }).expect(200).expectJson({ stock: 10, stockLabel: "10 in stock" });
    const inventory = await app.client.get(`/api/v1/seller/inventory?storeId=${storeId}`).auth(seller.accessToken).expect(200);
    expect(inventory.json<unknown[]>()).toHaveLength(3);
  });

  it("reserves stock all-or-nothing through the catalog port", async () => {
    const { seller, storeId } = await createSellerWithStore();
    const product = await createProduct(seller, storeId, { title: "Cap", price: 500_000, variants: [{ size: "S", stock: 5 }, { size: "M", stock: 1 }] });
    const [small, medium] = product.variants;
    const catalog = app.dependencies.ports.productCatalog;
    await expect(catalog.reserveStock([{ variantId: small?.id ?? "", quantity: 2 }, { variantId: medium?.id ?? "", quantity: 2 }])).rejects.toThrow("insufficient stock");
    const afterFailure = await catalog.findPurchasableVariants([small?.id ?? "", medium?.id ?? ""]);
    expect(afterFailure.map((variant) => variant.stock).sort()).toEqual([1, 5]);
    expect(afterFailure.every((variant) => !variant.purchasable)).toBe(true);

    await catalog.reserveStock([{ variantId: small?.id ?? "", quantity: 2 }, { variantId: small?.id ?? "", quantity: 1 }]);
    const afterSuccess = await catalog.findPurchasableVariants([small?.id ?? ""]);
    expect(afterSuccess[0]?.stock).toBe(2);
  });

  it("hides products of suspended stores and builds the mart home sections", async () => {
    const { seller, storeId } = await createSellerWithStore();
    const admin = await app.registerAdmin();
    const sale = await createProduct(seller, storeId, { title: "Blender Deal", price: 800_000, compareAtPrice: 1_000_000, stock: 4 });
    await app.client.post(`/api/v1/seller/products/${sale.id}/publish`).auth(seller.accessToken).expect(200);
    await app.client.post(`/api/v1/admin/stores/${storeId}/featured`).auth(admin.accessToken).send({ featured: true }).expect(200);

    const home = await app.client.get("/api/v1/mart/home").expect(200);
    const sections = home.json<{ salesOfTheDay: { id: string; discountPercent: number }[]; featuredBrands: { id: string }[]; newArrivals: { id: string }[] }>();
    expect(sections.salesOfTheDay.find((item) => item.id === sale.id)?.discountPercent).toBe(20);
    expect(sections.featuredBrands.map((store) => store.id)).toContain(storeId);
    expect(sections.newArrivals.map((item) => item.id)).toContain(sale.id);

    await app.client.post(`/api/v1/admin/stores/${storeId}/status`).auth(admin.accessToken).send({ status: "suspended" }).expect(200);
    await app.client.get(`/api/v1/products/${sale.id}`).expect(404);
  });

  it("filters, sorts and relates products", async () => {
    const { seller, storeId } = await createSellerWithStore();
    const categories = await app.client.get("/api/v1/categories").expect(200);
    const kids = categories.json<{ id: string; slug: string }[]>().find((category) => category.slug === "kids");
    const ids: string[] = [];
    for (const [title, price] of [["Toy Car", 300_000], ["Toy Plane", 900_000], ["Toy Boat", 600_000]] as const) {
      const product = await createProduct(seller, storeId, { title, price, stock: 2, categoryId: kids?.id });
      await app.client.post(`/api/v1/seller/products/${product.id}/publish`).auth(seller.accessToken).expect(200);
      ids.push(product.id);
    }
    const sorted = await app.client.get("/api/v1/products").set("x-client-region", "NG").query({ categorySlug: "kids", sort: "price_asc" }).expect(200);
    expect(sorted.json<{ data: { price: { amountMinor: number } }[] }>().data.map((item) => item.price.amountMinor)).toEqual([300_000, 600_000, 900_000]);
    const filtered = await app.client.get("/api/v1/products").set("x-client-region", "NG").query({ storeId, minPrice: "500000", maxPrice: "700000" }).expect(200);
    expect(filtered.json<{ data: { title: string }[] }>().data.map((item) => item.title)).toEqual(["Toy Boat"]);
    const inPounds = await app.client.get("/api/v1/products").set("x-client-region", "GB").query({ storeId, minPrice: "250", maxPrice: "350" }).expect(200);
    expect(inPounds.json<{ data: { title: string; price: unknown }[] }>().data).toEqual([expect.objectContaining({ title: "Toy Boat", price: { amountMinor: 302, currency: "GBP" } })]);
    const detail = await app.client.get(`/api/v1/products/${ids[0] ?? ""}`).expect(200);
    expect(detail.json<{ related: { id: string }[] }>().related.map((item) => item.id).sort()).toEqual([ids[1], ids[2]].sort());
  });

  it("converts prices into the viewer's currency and shows sellers their native prices", async () => {
    const { seller, storeId } = await createSellerWithStore();
    const product = await createProduct(seller, storeId, { title: "Adire Shirt", price: 1_500_000, compareAtPrice: 3_100_000, stock: 2 });
    await app.client.post(`/api/v1/seller/products/${product.id}/publish`).auth(seller.accessToken).expect(200);

    const british = await app.client.get(`/api/v1/products/${product.id}`).set("x-client-region", "GB").expect(200);
    expect(british.json()).toMatchObject({
      price: { amountMinor: 755, currency: "GBP" },
      compareAtPrice: { amountMinor: 1560, currency: "GBP" },
      variants: [{ price: { amountMinor: 755, currency: "GBP" } }],
      store: { currency: "NGN", shippingFee: { amountMinor: 75, currency: "GBP" } },
    });
    const brazilian = await app.client.get(`/api/v1/products/${product.id}`).set("x-client-region", "BR").expect(200);
    expect(brazilian.json()).toMatchObject({ price: { amountMinor: 968, currency: "USD" } });
    const home = await app.client.get("/api/v1/mart/home").set("x-client-region", "GB").expect(200);
    expect(home.json()).toMatchObject({ currency: "GBP" });

    await app.client.patch("/api/v1/users/me/preferences").auth(seller.accessToken).send({ countryCode: "GB" }).expect(200);
    const sellerView = await app.client.get(`/api/v1/seller/products?storeId=${storeId}`).auth(seller.accessToken).expect(200);
    expect(sellerView.json<{ data: unknown[] }>().data).toEqual([expect.objectContaining({ price: { amountMinor: 1_500_000, currency: "NGN" } })]);
    const summaries = await app.dependencies.ports.productCatalog.findProductSummaries([product.id]);
    expect(summaries[0]).toMatchObject({ price: 1_500_000, currency: "NGN" });
    const variants = await app.dependencies.ports.productCatalog.findPurchasableVariants([product.variants[0]?.id ?? ""]);
    expect(variants[0]).toMatchObject({ unitPrice: 1_500_000, currency: "NGN" });
    const stores = await app.dependencies.ports.storeAccess.findStoreSummaries([storeId]);
    expect(stores[0]).toMatchObject({ currency: "NGN", shippingFee: 150_000 });
  });
});
