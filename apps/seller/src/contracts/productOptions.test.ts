import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyOptionChanges, convertDraftToUpsertRequest, convertProductToDraft, createEmptyProductDraft, createOptionDraft, type OptionDraft, type ProductDraft } from "@/components/catalog/productEditorDraft.util";
import { describeOptionIssues, describeRemovedVariantsWithStock } from "@/components/catalog/productOptionIssues.util";
import { addOptionValues } from "@/components/catalog/productOptions.util";
import { dispatchMockApiRequest } from "@/mocks/mockBackend.mock";
import type { Product } from "@/types/catalog.type";
import { validateProductUpsertRequest } from "@/utils/productValidation.util";

const context = { categoryIds: null, locationIds: null, skusUsedByOtherProducts: new Set<string>(), barcodesUsedByOtherProducts: new Set<string>() };

async function callMock(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const encoded = body === undefined ? null : new TextEncoder().encode(JSON.stringify(body));
  const response = await dispatchMockApiRequest({ method, path, query: new URLSearchParams(), headers: new Headers({ "content-type": "application/json", ...headers }), body: encoded });
  return { status: response.status, body: response.body as unknown };
}

function withOptions(draft: ProductDraft, update: (options: readonly OptionDraft[]) => OptionDraft[]): ProductDraft {
  return { ...draft, ...applyOptionChanges(update(draft.options), draft.variants) };
}

function addValues(draft: ProductDraft, optionName: string, text: string): ProductDraft {
  return withOptions(draft, (options) => options.map((option) => (option.name === optionName ? { ...option, values: addOptionValues(option.values, text).values } : option)));
}

function priced(draft: ProductDraft, prefix: string): ProductDraft {
  return { ...draft, variants: draft.variants.map((variant, index) => ({ ...variant, sku: variant.sku || `${prefix}-${index + 1}`, priceText: variant.priceText || "5000" })) };
}

describe("product option chips map to catalog's ProductUpsertRequest", () => {
  it("builds options[{name, values}] and one variant per combination, keeping the first variant's price", () => {
    let draft: ProductDraft = { ...createEmptyProductDraft(), name: "Ankara shirt" };
    draft = { ...draft, variants: [{ ...draft.variants[0]!, priceText: "7500" }] };
    draft = withOptions(draft, (options) => [...options, createOptionDraft("Size")]);
    draft = addValues(draft, "Size", "S, M, m");
    draft = withOptions(draft, (options) => [...options, createOptionDraft("Colour")]);
    draft = addValues(draft, "Colour", "Red,🔵 Blue");
    const { request, parseIssues } = convertDraftToUpsertRequest(priced(draft, "SHIRT"), "NGN", true);
    assert.deepEqual(parseIssues, []);
    assert.deepEqual(request.options, [{ name: "Size", values: ["S", "M"] }, { name: "Colour", values: ["Red", "🔵 Blue"] }]);
    assert.deepEqual(request.variants.map((variant) => variant.optionValues), [{ Size: "S", Colour: "Red" }, { Size: "S", Colour: "🔵 Blue" }, { Size: "M", Colour: "Red" }, { Size: "M", Colour: "🔵 Blue" }]);
    assert.ok(request.variants.every((variant) => variant.priceMinor === 750_000));
    assert.deepEqual(validateProductUpsertRequest(request, context), []);
  });

  it("keeps saved variant ids and SKUs through rename, reorder, a new value and a new option", async () => {
    const login = await callMock("POST", "/auth/login", {}, { identifier: "adaeze@ifelifestyle.ng", password: "Zudomart2026!" });
    const headers = { authorization: `Bearer ${(login.body as { accessToken: string }).accessToken}` };
    let draft: ProductDraft = withOptions({ ...createEmptyProductDraft(), name: "Option chips tee" }, () => [createOptionDraft("Size", ["S", "M"])]);
    const created = await callMock("POST", "/seller/products", headers, convertDraftToUpsertRequest(priced(draft, "CHIPTEE"), "NGN", true).request);
    assert.ok(created.status < 300, JSON.stringify(created.body));
    const saved = created.body as Product;
    let edit = convertProductToDraft(saved);
    edit = withOptions(edit, (options) => options.map((option) => ({ ...option, name: "Fit", values: [...option.values].reverse() })));
    edit = addValues(edit, "Fit", "L");
    edit = withOptions(edit, (options) => [...options, createOptionDraft("Colour", ["Black"])]);
    const savedIds = new Map(saved.variants.map((variant) => [variant.optionValues.Size, variant]));
    for (const size of ["S", "M"]) {
      const kept = edit.variants.find((variant) => variant.optionValues.Fit === size)!;
      assert.equal(kept.id, savedIds.get(size)!.id);
      assert.equal(kept.sku, savedIds.get(size)!.sku);
      assert.deepEqual(kept.optionValues, { Fit: size, Colour: "Black" });
    }
    const updated = await callMock("PATCH", `/seller/products/${saved.id}`, headers, convertDraftToUpsertRequest(priced(edit, "CHIPTEE2"), "NGN", false).request);
    assert.ok(updated.status < 300, JSON.stringify(updated.body));
    const after = updated.body as Product;
    assert.deepEqual(after.options, [{ name: "Fit", values: ["M", "S", "L"] }, { name: "Colour", values: ["Black"] }]);
    assert.ok(saved.variants.every((variant) => after.variants.some((kept) => kept.id === variant.id && kept.sku === variant.sku)));
  });

  it("does not drop variants while an option name is being retyped", () => {
    const start = withOptions(createEmptyProductDraft(), () => [createOptionDraft("Size", ["S", "M"])]);
    const keys = start.variants.map((variant) => variant.key);
    const cleared = withOptions(start, (options) => options.map((option) => ({ ...option, name: "" })));
    assert.deepEqual(cleared.variants.map((variant) => variant.key), keys);
    const retyped = withOptions(cleared, (options) => options.map((option) => ({ ...option, name: "Fit" })));
    assert.deepEqual(retyped.variants.map((variant) => [variant.key, variant.optionValues]), [[keys[0], { Fit: "S" }], [keys[1], { Fit: "M" }]]);
  });

  it("blocks unsaved text, too many variants and removing variants that still have stock", () => {
    const pending = [{ ...createOptionDraft("Size", ["S"]), pendingText: "XL" }];
    assert.match(describeOptionIssues(pending, [], [])[0]!.message, /keep “XL”/);
    assert.deepEqual(describeOptionIssues([{ ...createOptionDraft("Size", ["S"]), pendingText: "  " }], [], []), []);
    const many = Array.from({ length: 11 }, (_, index) => `v${index}`);
    assert.ok(describeOptionIssues([createOptionDraft("A", many), createOptionDraft("B", many)], [], []).some((issue) => /121 variants/.test(issue.message)));
    const savedVariant = { id: "var_1", title: "S", stock: [{ locationId: "l1", onHand: 3, reserved: 0 }] } as unknown as Product["variants"][number];
    assert.match(describeRemovedVariantsWithStock([savedVariant], []) ?? "", /S still has stock/);
    assert.equal(describeRemovedVariantsWithStock([{ ...savedVariant, stock: [{ locationId: "l1", onHand: 0, reserved: 0 }] }], []), null);
  });

  it("rejects values catalog would reject, counting emoji in bytes", () => {
    const { request } = convertDraftToUpsertRequest(priced(withOptions({ ...createEmptyProductDraft(), name: "Emoji tee" }, () => [createOptionDraft("Mood", ["🔥".repeat(11)])]), "EMO"), "NGN", true);
    assert.ok(validateProductUpsertRequest(request, context).some((issue) => issue.path === "options.0.values"));
    const fourOptions = { ...request, options: ["A", "B", "C", "D"].map((name) => ({ name, values: ["x"] })) };
    assert.ok(validateProductUpsertRequest(fourOptions, context).some((issue) => issue.path === "options"));
  });
});
