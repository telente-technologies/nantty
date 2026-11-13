import assert from "node:assert/strict";
import test from "node:test";

import type { ProductVariant } from "@/types/models.type";
import { findSelectedProductVariant, productPurchaseAvailability, readProductVariantGroups } from "./productVariants.util";

const variants: ProductVariant[] = [
  { id: "small-red", title: "Small / Red / Cotton", size: "S", color: "Red", price: { amountMinor: 1000, currency: "NGN" }, inStock: true, optionValues: { Size: "S", Color: "Red", Material: "Cotton" } },
  { id: "large-red", title: "Large / Red / Cotton", size: "L", color: "Red", price: { amountMinor: 1200, currency: "NGN" }, inStock: true, optionValues: { Size: "L", Color: "Red", Material: "Cotton" } },
  { id: "small-blue", title: "Small / Blue / Linen", size: "S", color: "Blue", price: { amountMinor: 1300, currency: "NGN" }, inStock: false, optionValues: { Size: "S", Color: "Blue", Material: "Linen" } },
];

test("derives distinct option groups from the buyer product detail variant response", () => {
  assert.deepEqual(readProductVariantGroups(null, variants), [{ name: "Material", options: ["Cotton", "Linen"] }]);
});

test("uses declared option groups and resolves exactly one selected variant", () => {
  const groups = readProductVariantGroups([{ name: "Material", options: ["Cotton", "Linen"] }], variants);
  const selected = findSelectedProductVariant({ sizes: ["S", "L"], colors: ["Red", "Blue"], variants }, groups, "L", "Red", { Material: "Cotton" });
  assert.equal(selected?.id, "large-red");
  assert.equal(selected?.price.amountMinor, 1200);
});

test("does not resolve a variant while required dimensions are unselected", () => {
  const groups = readProductVariantGroups(null, variants);
  assert.equal(findSelectedProductVariant({ sizes: ["S", "L"], colors: ["Red", "Blue"], variants }, groups, null, "Red", { Material: "Cotton" }), null);
});

test("rejects invalid options and known out-of-stock products before cart submission", () => {
  assert.equal(productPurchaseAvailability({ variants }, null, true), "choose_options");
  assert.equal(productPurchaseAvailability({ variants }, null, false), "invalid_options");
  assert.equal(productPurchaseAvailability({ stock: 0 }, null, false), "out_of_stock");
  assert.equal(productPurchaseAvailability({ stock: 0 }, variants[0]!, false), "available");
  assert.equal(productPurchaseAvailability({ stock: 4 }, variants[2]!, false), "out_of_stock");
});
