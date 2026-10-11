import { resolveMockApiRequest } from "@/mocks";
import type { CatalogProduct } from "@/types/sellerCatalog.type";
import { createOptionGroupDraft } from "@/utils/productOptions.util";
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

  it("round-trips option chips as options[{name, values}] and keeps variant ids on edit", async () => {
    const locationId = "0190f3a2-7b1c-7cde-9f00-0000000000a1";
    const form = { ...EMPTY_PRODUCT_FORM, name: "Ankara tee", priceInMajorUnits: "20", stock: "0", optionGroups: [createOptionGroupDraft("Size", ["S", "M"]), createOptionGroupDraft("Colour", ["Red", "🔵 Blue"])] };
    const body = buildCatalogProductUpsertRequest({ form, images: [], brand: null, existing: null, defaultLocationId: locationId, skuSeed: "OPT" });
    expect(Object.keys(body).sort()).toEqual(["brand", "categoryId", "description", "imageMediaIds", "name", "options", "publishedOnline", "status", "tags", "taxable", "trackInventory", "variants"]);
    const created = await resolveMockApiRequest<CatalogProduct>("POST", "/api/v1/seller/products", body);
    expect(created.options).toEqual([{ name: "Size", values: ["S", "M"] }, { name: "Colour", values: ["Red", "🔵 Blue"] }]);
    expect(created.variants).toHaveLength(4);
    const edited = formValuesFromCatalogProduct(created);
    const withLarge = { ...edited, optionGroups: edited.optionGroups.map((group) => (group.name === "Size" ? { ...group, values: [...group.values, "L"] } : group)) };
    const updated = await resolveMockApiRequest<CatalogProduct>("PATCH", `/api/v1/seller/products/${created.id}`, buildCatalogProductUpsertRequest({ form: withLarge, images: [], brand: null, existing: created, defaultLocationId: null, skuSeed: "OPT2" }));
    expect(updated.variants).toHaveLength(6);
    expect(created.variants.every((variant) => updated.variants.some((kept) => kept.id === variant.id && kept.sku === variant.sku))).toBe(true);
  });

  it("rejects option bodies catalog would reject", async () => {
    const base = buildCatalogProductUpsertRequest({ form: { ...EMPTY_PRODUCT_FORM, name: "Clay pot", priceInMajorUnits: "12", stock: "0" }, images: [], brand: null, existing: null, defaultLocationId: null, skuSeed: "R" });
    const variant = base.variants[0]!;
    await expect(resolveMockApiRequest("POST", "/api/v1/seller/products", { ...base, options: [{ name: "Size", values: ["🔥".repeat(11)] }], variants: [{ ...variant, optionValues: { Size: "🔥".repeat(11) } }] })).rejects.toMatchObject({ status: 400 });
    await expect(resolveMockApiRequest("POST", "/api/v1/seller/products", { ...base, options: [{ name: "Size", values: ["S", "S"] }], variants: [{ ...variant, optionValues: { Size: "S" } }] })).rejects.toMatchObject({ status: 400 });
    await expect(resolveMockApiRequest("POST", "/api/v1/seller/products", { ...base, options: [{ name: "Size", values: ["S"] }], variants: [variant] })).rejects.toMatchObject({ status: 400 });
  });
});
