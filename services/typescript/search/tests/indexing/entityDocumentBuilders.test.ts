import { describe, expect, it } from "vitest";

import { buildCategoryDocument, buildPostDocument, extractHashtags, resolvePostVisibility } from "../../src/modules/indexing/services/contentDocumentBuilders.service.js";
import { buildProductDocument, buildUserDocument, isProductListable } from "../../src/modules/indexing/services/entityDocumentBuilders.service.js";
import { categorySource, postSource, productSource, userSource } from "../fakes/sourceFixtures.fake.js";

describe("product documents", () => {
  it("lists only published, public, in-stock products of active stores", () => {
    expect(isProductListable(productSource())).toBe(true);
    expect(isProductListable(productSource({ stock: 0 }))).toBe(false);
    expect(isProductListable(productSource({ status: "draft" }))).toBe(false);
    expect(isProductListable(productSource({ visibility: "private" }))).toBe(false);
    expect(isProductListable(productSource({ storeActive: false }))).toBe(false);
  });

  it("keeps money as integer minor units with a currency", () => {
    expect(buildProductDocument(productSource(), 1).summary["price"]).toEqual({ amountMinor: 2500000, currency: "NGN" });
  });
});

describe("user documents", () => {
  it("is unavailable when the account is not active", () => {
    expect(buildUserDocument(userSource({ status: "suspended" }), 1).available).toBe(false);
    expect(buildUserDocument(userSource(), 1).available).toBe(true);
  });

  it("never copies private fields into the summary", () => {
    const summary = buildUserDocument(userSource({ bio: "secret bio" }), 1).summary;
    expect(Object.keys(summary).sort()).toEqual(["avatarUrl", "followers", "id", "isCreator", "name", "username", "verification", "verified"]);
  });
});

describe("post and clip documents", () => {
  it("skips stories and hides removed or subscriber-only content", () => {
    expect(buildPostDocument(postSource({ kind: "story" }), 1)).toBeNull();
    expect(resolvePostVisibility(postSource({ removed: true }))).toBe("hidden");
    expect(resolvePostVisibility(postSource({ visibility: "subscribers" }))).toBe("hidden");
    expect(resolvePostVisibility(postSource({ audience: "followers" }))).toBe("followers");
    expect(buildPostDocument(postSource({ kind: "clip" }), 1)?.kind).toBe("clip");
  });

  it("collects hashtags from the caption and the declared list without duplicates", () => {
    expect(extractHashtags("Look #Sneakers #sneakers and #Lagos_Life", ["#kicks"])).toEqual(["kicks", "sneakers", "lagos_life"]);
  });
});

describe("category documents", () => {
  it("indexes synonyms as searchable body text", () => {
    expect(buildCategoryDocument(categorySource(), 1).body).toBe("trainers");
  });
});
