import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { convertDraftToUpsertRequest, convertProductToDraft, createEmptyProductDraft, type ProductDraft } from "@/components/catalog/productEditorDraft.util";
import { dispatchMockApiRequest } from "@/mocks/mockBackend.mock";
import type { Product } from "@/types/catalog.type";
import { validateProductUpsertRequest } from "@/utils/productValidation.util";

const context = { categoryIds: null, locationIds: null, skusUsedByOtherProducts: new Set<string>(), barcodesUsedByOtherProducts: new Set<string>() };

async function callMock(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const encoded = body === undefined ? null : new TextEncoder().encode(JSON.stringify(body));
  const response = await dispatchMockApiRequest({ method, path, query: new URLSearchParams(), headers: new Headers({ "content-type": "application/json", ...headers }), body: encoded });
  return { status: response.status, body: response.body as unknown };
}

function parcelDraft(): ProductDraft {
  return {
    ...createEmptyProductDraft(),
    name: "Parcel tee",
    weightGramsText: "500",
    lengthMmText: "300",
    widthMmText: "200",
    heightMmText: "100",
    packageCategory: "apparel",
    packageCountText: "2",
    fragile: true,
    contentsDescription: "two folded shirts",
    declaredValueText: "5000",
    variants: createEmptyProductDraft().variants.map((variant) => ({ ...variant, sku: "PARCEL-TEE", priceText: "5000" })),
  };
}

describe("product parcel fields map to the seller API and survive a round trip", () => {
  it("converts weight, dimensions, packaging and declared value into ProductUpsertRequest", () => {
    const { request, parseIssues } = convertDraftToUpsertRequest(parcelDraft(), "NGN", true);
    assert.deepEqual(parseIssues, []);
    assert.equal(request.weightGrams, 500);
    assert.equal(request.lengthMm, 300);
    assert.equal(request.widthMm, 200);
    assert.equal(request.heightMm, 100);
    assert.equal(request.packageCategory, "apparel");
    assert.equal(request.packageCount, 2);
    assert.equal(request.fragile, true);
    assert.equal(request.contentsDescription, "two folded shirts");
    assert.equal(request.declaredValueMinor, 500_000);
    assert.deepEqual(validateProductUpsertRequest(request, context), []);
  });

  it("rejects incomplete dimensions and out-of-range parcel values", () => {
    const partial = { ...parcelDraft(), widthMmText: "" };
    const partialRequest = convertDraftToUpsertRequest(partial, "NGN", true).request;
    assert.ok(validateProductUpsertRequest(partialRequest, context).some((issue) => issue.path === "lengthMm" && /together/.test(issue.message)));

    const invalid = { ...parcelDraft(), weightGramsText: "1000001", packageCountText: "0" };
    const invalidRequest = convertDraftToUpsertRequest(invalid, "NGN", true).request;
    const issues = validateProductUpsertRequest(invalidRequest, context);
    assert.ok(issues.some((issue) => issue.path === "weightGrams"));
    assert.ok(issues.some((issue) => issue.path === "packageCount"));
  });

  it("persists the fields through create and update in the demo backend", async () => {
    const login = await callMock("POST", "/auth/login", {}, { identifier: "adaeze@ifelifestyle.ng", password: "Zudomart2026!" });
    const headers = { authorization: `Bearer ${(login.body as { accessToken: string }).accessToken}` };
    const created = await callMock("POST", "/seller/products", headers, convertDraftToUpsertRequest(parcelDraft(), "NGN", true).request);
    assert.ok(created.status < 300, JSON.stringify(created.body));
    const saved = created.body as Product;
    assert.equal(saved.weightGrams, 500);
    assert.equal(saved.lengthMm, 300);
    assert.equal(saved.widthMm, 200);
    assert.equal(saved.heightMm, 100);
    assert.equal(saved.packageCategory, "apparel");
    assert.equal(saved.packageCount, 2);
    assert.equal(saved.fragile, true);
    assert.equal(saved.contentsDescription, "two folded shirts");
    assert.equal(saved.declaredValueMinor, 500_000);

    const edit = convertProductToDraft(saved);
    assert.equal(edit.weightGramsText, "500");
    assert.equal(edit.lengthMmText, "300");
    assert.equal(edit.widthMmText, "200");
    assert.equal(edit.heightMmText, "100");
    assert.equal(edit.packageCategory, "apparel");
    assert.equal(edit.packageCountText, "2");
    assert.equal(edit.fragile, true);
    assert.equal(edit.contentsDescription, "two folded shirts");
    assert.equal(edit.declaredValueText, "5000.00");

    const changed: ProductDraft = { ...edit, weightGramsText: "600", lengthMmText: "310", widthMmText: "210", heightMmText: "110", packageCategory: "home", packageCountText: "3", fragile: false, contentsDescription: "three items", declaredValueText: "6000" };
    const updated = await callMock("PATCH", `/seller/products/${saved.id}`, headers, convertDraftToUpsertRequest(changed, "NGN", false).request);
    assert.ok(updated.status < 300, JSON.stringify(updated.body));
    const after = updated.body as Product;
    assert.equal(after.weightGrams, 600);
    assert.equal(after.lengthMm, 310);
    assert.equal(after.widthMm, 210);
    assert.equal(after.heightMm, 110);
    assert.equal(after.packageCategory, "home");
    assert.equal(after.packageCount, 3);
    assert.equal(after.fragile, false);
    assert.equal(after.contentsDescription, "three items");
    assert.equal(after.declaredValueMinor, 600_000);
  });
});
