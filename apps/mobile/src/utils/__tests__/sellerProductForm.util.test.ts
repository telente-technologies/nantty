import type { CatalogProduct } from "@/types/sellerCatalog.type";

import { createOptionGroupDraft } from "../productOptions.util";
import { buildCatalogProductUpsertRequest, describeOptionRemovalImpact, describeVariantsBlockedByStock, EMPTY_PRODUCT_FORM, formValuesFromCatalogProduct, summariseProductForInventory, validateProductForm, type ChosenBrand } from "../sellerProductForm.util";

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

const withValues = (form: ReturnType<typeof formValuesFromCatalogProduct>, name: string, values: string[]) => ({ ...form, optionGroups: form.optionGroups.map((group) => (group.name === name ? { ...group, values } : group)) });
const save = (form: ReturnType<typeof formValuesFromCatalogProduct>, brand: ChosenBrand | null = null) => buildCatalogProductUpsertRequest({ form, images: product.images, brand, existing: product, defaultLocationId: null, skuSeed: "X" });

describe("mobile seller product form", () => {
  it("reads catalog products, including custom option groups", () => {
    const form = formValuesFromCatalogProduct(product);
    expect(form).toMatchObject({ priceInMajorUnits: "4500.00", stock: "5" });
    expect(form.optionGroups.map((group) => [group.name, group.values, group.originalName])).toEqual([["Size", ["S", "M"], "Size"], ["Fabric", ["Cotton"], "Fabric"]]);
    expect(summariseProductForInventory(product, "NGN")).toEqual({ name: "Adire top", imageUrl: "https://cdn/1.jpg", price, stock: 5 });
  });

  it("sends catalog's ProductUpsertRequest, keeping variant ids, skus, photos and the brand relationship", () => {
    const request = buildCatalogProductUpsertRequest({
      form: withValues(formValuesFromCatalogProduct(product), "Size", ["S", "M", "L"]),
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

  it("parses comma-formatted prices accurately and rejects malformed numbers", () => {
    const request = buildCatalogProductUpsertRequest({ form: { ...EMPTY_PRODUCT_FORM, name: "Loom", priceInMajorUnits: "1,250.50", stock: "2" }, images: [], brand: null, existing: null, defaultLocationId: "l1", skuSeed: "X" });
    expect(request.variants[0]?.priceMinor).toBe(125_050);
    expect(validateProductForm({ ...EMPTY_PRODUCT_FORM, name: "Loom", priceInMajorUnits: "1,250.50", stock: "2" }, [], true)).toBeNull();
    expect(validateProductForm({ ...EMPTY_PRODUCT_FORM, name: "Loom", priceInMajorUnits: "12abc", stock: "2" }, [], true)).toMatch(/above zero/);
  });

  it("validates like the catalog", () => {
    expect(validateProductForm({ ...EMPTY_PRODUCT_FORM, name: "P" }, [], true)).toMatch(/2 to 120/);
    expect(validateProductForm({ ...EMPTY_PRODUCT_FORM, name: "Pot", priceInMajorUnits: "5", stock: "" }, [], true)).toMatch(/stock/);
    expect(validateProductForm({ ...EMPTY_PRODUCT_FORM, name: "Pot", priceInMajorUnits: "5" }, [], false)).toBeNull();
    const fourGroups = { ...EMPTY_PRODUCT_FORM, name: "Pot", priceInMajorUnits: "5", stock: "1", optionGroups: ["Size", "Colour", "A", "B"].map((name) => createOptionGroupDraft(name, ["x"])) };
    expect(validateProductForm(fourGroups, [], true)).toMatch(/up to 3/);
  });

  it("builds options, variants and opening stock from option chips on a new product", () => {
    const form = { ...EMPTY_PRODUCT_FORM, name: "Tee", priceInMajorUnits: "10", stock: "4", optionGroups: [createOptionGroupDraft("Size", ["S", "M"]), createOptionGroupDraft("Colour", ["Red", "Blue"])] };
    const request = buildCatalogProductUpsertRequest({ form, images: [], brand: null, existing: null, defaultLocationId: "l1", skuSeed: "X" });
    expect(request.options).toEqual([{ name: "Size", values: ["S", "M"] }, { name: "Colour", values: ["Red", "Blue"] }]);
    expect(request.variants.map((variant) => [variant.optionValues, variant.sku, variant.id])).toEqual([
      [{ Size: "S", Colour: "Red" }, "ZM-X-1", null], [{ Size: "S", Colour: "Blue" }, "ZM-X-2", null], [{ Size: "M", Colour: "Red" }, "ZM-X-3", null], [{ Size: "M", Colour: "Blue" }, "ZM-X-4", null],
    ]);
    expect(request.variants.every((variant) => variant.openingStock[0]?.quantity === 4 && variant.priceMinor === 1000)).toBe(true);
  });

  it("keeps variant ids and skus when options are renamed, reordered or extended", () => {
    const form = formValuesFromCatalogProduct(product);
    const renamed = { ...form, optionGroups: form.optionGroups.map((group) => (group.name === "Size" ? { ...group, name: "Fit", values: ["M", "S"] } : group)) };
    const request = save(renamed);
    expect(request.options[0]).toEqual({ name: "Fit", values: ["M", "S"] });
    expect(request.variants.map((variant) => [variant.id, variant.sku, variant.optionValues])).toEqual([["v2", "ADIRE-M", { Fit: "M", Fabric: "Cotton" }], ["v1", "ADIRE-S", { Fit: "S", Fabric: "Cotton" }]]);
    const extended = { ...form, optionGroups: [...form.optionGroups, createOptionGroupDraft("Colour", ["Blue", "Red"])] };
    expect(save(extended).variants.filter((variant) => variant.id).map((variant) => [variant.id, variant.optionValues.Colour])).toEqual([["v1", "Blue"], ["v2", "Blue"]]);
  });

  it("warns before removing saved variants and blocks saving while they still have stock", () => {
    const form = formValuesFromCatalogProduct(product);
    const withoutS = withValues(form, "Size", ["M"]);
    expect(describeOptionRemovalImpact(form, withoutS, product)).toMatch(/S \/ Cotton will be deleted.*4 units are still in stock/);
    expect(describeVariantsBlockedByStock(withoutS, product)).toMatch(/S \/ Cotton still has stock/);
    expect(describeOptionRemovalImpact(form, withValues(form, "Size", ["S", "M", "L"]), product)).toBeNull();
    expect(describeOptionRemovalImpact(form, withoutS, null)).toBeNull();
  });

  it("blocks saving with an unsaved value, a nameless option or too many variants", () => {
    const base = { ...EMPTY_PRODUCT_FORM, name: "Pot", priceInMajorUnits: "5", stock: "1" };
    expect(validateProductForm({ ...base, optionGroups: [{ ...createOptionGroupDraft("Size", ["S"]), pendingText: "XL" }] }, [], true)).toMatch(/Tap Add to keep “XL”/);
    expect(validateProductForm({ ...base, optionGroups: [{ ...createOptionGroupDraft("Size", ["S"]), pendingText: "   " }] }, [], true)).toBeNull();
    expect(validateProductForm({ ...base, optionGroups: [createOptionGroupDraft("", ["S"])] }, [], true)).toMatch(/name/);
    expect(validateProductForm({ ...base, optionGroups: [createOptionGroupDraft("Size", ["S"]), createOptionGroupDraft("size", ["M"])] }, [], true)).toMatch(/already have an option called Size/);
    const many = Array.from({ length: 11 }, (_, index) => `v${index}`);
    expect(validateProductForm({ ...base, optionGroups: [createOptionGroupDraft("A", many), createOptionGroupDraft("B", many)] }, [], true)).toMatch(/121 variants/);
  });
});
