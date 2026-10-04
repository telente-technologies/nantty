import assert from "node:assert/strict";
import { test } from "node:test";

import { convertDraftToUpsertRequest, createEmptyProductDraft } from "../components/catalog/productEditorDraft.util";
import { validateProductUpsertRequest } from "../utils/productValidation.util";

const context = { categoryIds: null, locationIds: null, skusUsedByOtherProducts: new Set<string>(), barcodesUsedByOtherProducts: new Set<string>() };

function draftWithPrices(regionalPriceTextByCurrency: Record<string, string>) {
  const draft = createEmptyProductDraft();
  const variant = { ...draft.variants[0]!, sku: "SKU-1", priceText: "5000", regionalPriceTextByCurrency };
  return { ...draft, name: "Ankara shirt", variants: [variant] };
}

test("country prices are optional, converted to minor units and skip empty or store-currency entries", () => {
  const { request, parseIssues } = convertDraftToUpsertRequest(draftWithPrices({ GHS: "45.50", USD: "", NGN: "9" }), "NGN", true);
  assert.deepEqual(parseIssues, []);
  assert.deepEqual(request.variants[0]!.regionalPrices, [{ currency: "GHS", priceMinor: 4550 }]);
  assert.deepEqual(validateProductUpsertRequest(request, context), []);
});

test("bad country prices are reported and unsupported or duplicate currencies are rejected", () => {
  assert.equal(convertDraftToUpsertRequest(draftWithPrices({ GHS: "0" }), "NGN", true).parseIssues.length, 1);
  const { request } = convertDraftToUpsertRequest(draftWithPrices({}), "NGN", true);
  const broken = { ...request, variants: [{ ...request.variants[0]!, regionalPrices: [{ currency: "GHS" as const, priceMinor: 100 }, { currency: "GHS" as const, priceMinor: 200 }] }] };
  assert.ok(validateProductUpsertRequest(broken, context).some((issue) => issue.path.includes("regionalPrices")));
  const unsupported = { ...request, variants: [{ ...request.variants[0]!, regionalPrices: [{ currency: "JPY" as never, priceMinor: 100 }] }] };
  assert.ok(validateProductUpsertRequest(unsupported, context).some((issue) => issue.path.includes("regionalPrices")));
});
