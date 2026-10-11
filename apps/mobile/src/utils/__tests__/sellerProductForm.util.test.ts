import type { CatalogProduct } from "@/types/sellerCatalog.type";

import { buildCatalogProductUpsertRequest, EMPTY_PRODUCT_FORM, formValuesFromCatalogProduct, summariseProductForInventory, validateProductForm } from "../sellerProductForm.util";

const price = { amountMinor: 450_000, currency: "NGN" as const };
const product: CatalogProduct = {
  id: "p1", name: "Adire top", description: "", categoryId: "c1", status: "active", publishedOnline: true, taxable: true, trackInventory: true, tags: ["adire"],
  images: [{ mediaId: "m1", url: "https://cdn/1.jpg" }],
  options: [{ name: "Size", values: ["S", "M"] }, { name: "Fabric", values: ["Cotton"] }],
  variants: [
    { id: "v1", title: "S / Cotton", optionValues: { Size: "S", Fabric: "Cotton" }, sku: "ADIRE-S", barcode: null, price, compareAtPrice: null, costPrice: null, lowStockThreshold: 3, stock: [{ locationId: "l1", onHand: 4, reserved: 1 }] },
    { id: "v2", title: "M / Cotton", optionValues: { Size: "M", Fabric: "Cotton" }, sku: "ADIRE-M", barcode: null, price, compareAtPrice: null, costPrice: null, lowStockThreshold: 3, stock: [{ locationId: "l1", onHand: 2, reserved: 0 }] },
  ],
  brand: { brandId: "b1", relationship: "own" },
};

describe("mobile seller product form", () => {
  it("reads catalog products, including custom option groups", () => {
    const form = formValuesFromCatalogProduct(product);
    expect(form).toMatchObject({ priceInMajorUnits: "4500.00", sizes: "S, M", stock: "5", variants: [{ name: "Fabric", options: "Cotton" }] });
    expect(summariseProductForInventory(product, "NGN")).toEqual({ name: "Adire top", imageUrl: "https://cdn/1.jpg", price, stock: 5 });
  });

  it("sends catalog's ProductUpsertRequest, keeping variant ids, skus, photos and the brand relationship", () => {
    const request = buildCatalogProductUpsertRequest({
      form: { ...formValuesFromCatalogProduct(product), sizes: "S, M, L" },
      images: [{ mediaId: "m2", url: "x" }, ...product.images],
      brand: { id: "b1", name: "Adire Co" },
      existing: product,
      defaultLocationId: "l1",
      skuSeed: "X",
    });
    expect(Object.keys(request)).not.toEqual(expect.arrayContaining(["price", "stock", "imageUrls", "sizes"]));
    expect(request.imageMediaIds).toEqual(["m2", "m1"]);
    expect(request.options.map((option) => option.name)).toEqual(["Size", "Fabric"]);
    expect(request.variants.map((variant) => [variant.id, variant.sku])).toEqual([["v1", "ADIRE-S"], ["v2", "ADIRE-M"], [null, "ZM-X-3"]]);
    expect(request.variants.every((variant) => variant.openingStock.length === 0)).toBe(true);
    expect(request.brand).toEqual({ brandId: "b1", relationship: "own" });
  });

  it("creates one default variant with opening stock at the default location", () => {
    const request = buildCatalogProductUpsertRequest({ form: { ...EMPTY_PRODUCT_FORM, name: "Clay pot", priceInMajorUnits: "12.5", stock: "7" }, images: [], brand: null, existing: null, defaultLocationId: "l1", skuSeed: "X" });
    expect(request.variants).toEqual([expect.objectContaining({ id: null, optionValues: {}, priceMinor: 1250, openingStock: [{ locationId: "l1", quantity: 7 }] })]);
    expect(request.brand).toBeNull();
  });

  it("validates like the catalog", () => {
    expect(validateProductForm({ ...EMPTY_PRODUCT_FORM, name: "P" }, [], true)).toMatch(/2 to 120/);
    expect(validateProductForm({ ...EMPTY_PRODUCT_FORM, name: "Pot", priceInMajorUnits: "5", stock: "" }, [], true)).toMatch(/stock/);
    expect(validateProductForm({ ...EMPTY_PRODUCT_FORM, name: "Pot", priceInMajorUnits: "5" }, [], false)).toBeNull();
    const fourGroups = { ...EMPTY_PRODUCT_FORM, name: "Pot", priceInMajorUnits: "5", stock: "1", sizes: "S", colors: "Red", variants: [{ name: "A", options: "x" }, { name: "B", options: "y" }] };
    expect(validateProductForm(fourGroups, [], true)).toMatch(/up to 3/);
  });
});
