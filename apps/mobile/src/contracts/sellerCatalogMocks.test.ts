import { resolveMockApiRequest } from "@/mocks";
import type { CatalogProduct } from "@/types/sellerCatalog.type";
import { buildCatalogProductUpsertRequest, EMPTY_PRODUCT_FORM, formValuesFromCatalogProduct } from "@/utils/sellerProductForm.util";

const listProducts = async () => resolveMockApiRequest<CatalogProduct[] | { data: CatalogProduct[] }>("GET", "/api/v1/seller/products", undefined).then((payload) => (Array.isArray(payload) ? payload : payload.data));

describe("seller catalog mocks", () => {
  it("lists catalog-shaped products with images, options and variants", async () => {
    const [product] = await listProducts();
    expect(product).toEqual(expect.objectContaining({ id: expect.any(String), status: "active", images: expect.any(Array), variants: expect.any(Array) }));
    expect(product!.variants[0]).toEqual(expect.objectContaining({ sku: expect.any(String), price: expect.objectContaining({ amountMinor: expect.any(Number) }) }));
  });

  it("rejects the old flat product body", async () => {
    await expect(resolveMockApiRequest("POST", "/api/v1/seller/products", { name: "Pot", description: "", price: { amountMinor: 100, currency: "NGN" }, stock: 1, sizes: [], colors: [], imageUrls: [] })).rejects.toMatchObject({ status: 400 });
  });

  it("creates, edits photos on and archives a product through the real contract", async () => {
    const created = await resolveMockApiRequest<CatalogProduct>("POST", "/api/v1/seller/products", buildCatalogProductUpsertRequest({ form: { ...EMPTY_PRODUCT_FORM, name: "Clay pot", priceInMajorUnits: "12", stock: "3" }, images: [], brand: null, existing: null, defaultLocationId: "0190f3a2-7b1c-7cde-9f00-0000000000a1", skuSeed: "T" }));
    expect(created.variants[0]?.stock[0]?.onHand).toBe(3);
    const session = await resolveMockApiRequest<{ uploadId: string; mediaId: string }>("POST", "/api/v1/media/uploads", { fileName: "p.jpg", mimeType: "image/jpeg", sizeBytes: 1000, purpose: "product" });
    const withUnreadyPhoto = buildCatalogProductUpsertRequest({ form: formValuesFromCatalogProduct(created), images: [{ mediaId: session.mediaId, url: "file://p.jpg" }], brand: null, existing: created, defaultLocationId: null, skuSeed: "T" });
    await expect(resolveMockApiRequest("PATCH", `/api/v1/seller/products/${created.id}`, withUnreadyPhoto)).rejects.toMatchObject({ code: "MEDIA_NOT_READY" });
    await resolveMockApiRequest("DELETE", `/api/v1/seller/products/${created.id}`, undefined);
    expect((await listProducts()).some((product) => product.id === created.id)).toBe(false);
    await expect(resolveMockApiRequest("GET", `/api/v1/seller/products/${created.id}x`, undefined)).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
  });
});
