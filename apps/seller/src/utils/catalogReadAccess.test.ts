import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildNavigationGroups } from "@/config/navigation.config";
import { doesAccessGrantPermission, findPermissionRequiredForApiCall, findPermissionRequiredForPage } from "@/config/rolePermissions.config";

describe("read-only seller catalog access", () => {
  const readOnlyCatalogAccess = { role: "sales" as const, permissions: ["catalog:view" as const] };

  it("allows catalog readers to reach the product list but keeps editor routes restricted", () => {
    assert.equal(findPermissionRequiredForPage("/products"), "catalog:view");
    assert.equal(findPermissionRequiredForPage("/products/product-123"), "products:manage");
    assert.equal(findPermissionRequiredForPage("/products/new"), "products:manage");
    assert.equal(doesAccessGrantPermission(readOnlyCatalogAccess, findPermissionRequiredForPage("/products")!), true);
    assert.equal(doesAccessGrantPermission(readOnlyCatalogAccess, "products:manage"), false);
  });

  it("shows the Products navigation item to catalog readers", () => {
    const productsItem = buildNavigationGroups().flatMap((group) => group.items).find((item) => item.href === "/products");
    assert.equal(productsItem?.permission, "catalog:view");
    assert.equal(doesAccessGrantPermission(readOnlyCatalogAccess, productsItem!.permission), true);
  });

  it("keeps product reads separate from product mutations in the BFF", () => {
    assert.equal(findPermissionRequiredForApiCall("GET", "/seller/products"), "catalog:view");
    assert.equal(findPermissionRequiredForApiCall("POST", "/seller/products"), "products:manage");
    assert.equal(findPermissionRequiredForApiCall("PATCH", "/seller/products/product-123"), "products:manage");
  });
});
