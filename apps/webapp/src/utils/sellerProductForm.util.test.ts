import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CatalogProduct } from "@/types/sellerCatalog.type";

import { buildCatalogProductUpsertRequest, EMPTY_SELLER_PRODUCT_FORM, formValuesFromCatalogProduct, hasConfirmedProductVisibility, totalOnHandStock, validateSellerProductForm } from "./sellerProductForm.util";

const price = { amountMinor: 450_000, currency: "NGN" as const };
const product: CatalogProduct = {
  id: "p1", name: "Adire top", description: "", categoryId: "c1", status: "active", publishedOnline: true, taxable: true, trackInventory: true, tags: ["adire"],
  images: [{ mediaId: "m1", url: "https://cdn/1.jpg" }],
  options: [{ name: "Size", values: ["S", "M"] }],
  variants: [
    { id: "v1", title: "S", optionValues: { Size: "S" }, sku: "ADIRE-S", barcode: null, price, compareAtPrice: null, costPrice: null, lowStockThreshold: 3, stock: [{ locationId: "l1", onHand: 4, reserved: 1 }] },
    { id: "v2", title: "M", optionValues: { Size: "M" }, sku: "ADIRE-M", barcode: null, price, compareAtPrice: null, costPrice: null, lowStockThreshold: 3, stock: [{ locationId: "l1", onHand: 2, reserved: 0 }] },
  ],
};

describe("seller product form", () => {
  it("reads a catalog product into the simple form", () => {
    const values = formValuesFromCatalogProduct(product);
    assert.equal(values.priceText, "4500.00");
    assert.equal(values.sizesText, "S, M");
    assert.equal(totalOnHandStock(product), 5);
  });

  it("keeps variant ids, skus and photos when editing and adds new sizes", () => {
    const request = buildCatalogProductUpsertRequest({ ...formValuesFromCatalogProduct(product), sizesText: "S, M, L" }, product, "l1", "X");
    assert.deepEqual(request.variants.map((variant) => [variant.id, variant.sku]), [["v1", "ADIRE-S"], ["v2", "ADIRE-M"], [null, "ZM-X-3"]]);
    assert.ok(request.variants.every((variant) => variant.openingStock.length === 0));
    assert.deepEqual(request.imageMediaIds, ["m1"]);
    assert.equal(request.categoryId, "c1");
    assert.deepEqual(request.tags, ["adire"]);
  });

  it("creates a single default variant with opening stock at the default location", () => {
    const request = buildCatalogProductUpsertRequest({ ...EMPTY_SELLER_PRODUCT_FORM, name: "Clay pot", priceText: "12.5", stockText: "7" }, null, "l1", "X");
    assert.deepEqual(request.options, []);
    assert.equal(request.variants.length, 1);
    assert.deepEqual(request.variants[0]?.openingStock, [{ locationId: "l1", quantity: 7 }]);
    assert.equal(request.variants[0]?.priceMinor, 1250);
  });

  it("validates name, price and stock like the catalog", () => {
    assert.deepEqual(Object.keys(validateSellerProductForm({ ...EMPTY_SELLER_PRODUCT_FORM, name: "a", priceText: "0", stockText: "-1" }, true)).sort(), ["name", "price", "stock"]);
    assert.equal(validateSellerProductForm({ ...EMPTY_SELLER_PRODUCT_FORM, name: "Pot", priceText: "5", stockText: "x" }, false).stock, undefined);
  });

  it("confirms requested publish and hide state from the refreshed server list", () => {
    const hidden = { ...product, publishedOnline: false };
    assert.equal(hasConfirmedProductVisibility([product], product.id, true), true);
    assert.equal(hasConfirmedProductVisibility([hidden], product.id, false), true);
    assert.equal(hasConfirmedProductVisibility([product], product.id, false), false);
    assert.equal(hasConfirmedProductVisibility([], product.id, true), false);
  });

  it("does not treat a non-active product as published even when the flag is true", () => {
    assert.equal(hasConfirmedProductVisibility([{ ...product, status: "draft" }], product.id, true), false);
  });
});
