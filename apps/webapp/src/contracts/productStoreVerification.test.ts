import assert from "node:assert/strict";
import test from "node:test";

import { buildCatalogProductSummary, catalogProductSeeds } from "@/mocks/productCatalog.mock";

test("product summaries preserve the store identity and verification shown by web Mart recommendation cards", () => {
  const verifiedSeed = catalogProductSeeds.find((seed) => seed.storeId === "s_tunde");
  const unverifiedSeed = catalogProductSeeds.find((seed) => seed.storeId === "s_food");
  assert.ok(verifiedSeed);
  assert.ok(unverifiedSeed);

  assert.deepEqual(
    [buildCatalogProductSummary(verifiedSeed).storeName, buildCatalogProductSummary(verifiedSeed).storeVerified],
    ["TundeTech Gadgets", true],
  );
  assert.deepEqual(
    [buildCatalogProductSummary(unverifiedSeed).storeName, buildCatalogProductSummary(unverifiedSeed).storeVerified],
    ["Mama Nkechi Foods", false],
  );
});
