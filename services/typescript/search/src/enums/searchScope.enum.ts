import type { SearchKind } from "../types/searchDocument.type.js";

export const searchScopes = ["top", "users", "people", "products", "stores", "brands", "posts", "clips", "hashtags", "sounds", "categories", "all"] as const;
export type SearchScope = (typeof searchScopes)[number];

export const kindsByScope: Readonly<Record<Exclude<SearchScope, "all">, readonly SearchKind[]>> = {
  top: ["user", "store", "brand", "product", "post", "clip", "hashtag", "sound", "category"],
  users: ["user"],
  people: ["user"],
  products: ["product"],
  stores: ["store"],
  brands: ["brand"],
  posts: ["post"],
  clips: ["clip"],
  hashtags: ["hashtag"],
  sounds: ["sound"],
  categories: ["category"],
};
