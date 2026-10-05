import type { SearchKind } from "../types/searchDocument.type.js";

export type SearchScope =
  | { readonly kind: "global" }
  | { readonly kind: "mart" }
  | { readonly kind: "store"; readonly storeId: string }
  | { readonly kind: "profile"; readonly accountId: string };

export const globalSearchScope: SearchScope = { kind: "global" };

export const kindsAllowedInScope: Readonly<Record<SearchScope["kind"], readonly SearchKind[]>> = {
  global: ["user", "store", "brand", "product", "post", "clip", "hashtag", "sound", "category"],
  mart: ["product", "category"],
  store: ["product", "post", "clip"],
  profile: ["post", "clip", "product"],
};
