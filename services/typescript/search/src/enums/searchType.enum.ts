import type { SearchKind } from "../types/searchDocument.type.js";

export const searchTypes = ["top", "users", "people", "products", "stores", "brands", "posts", "clips", "hashtags", "sounds", "categories", "all"] as const;
export type SearchType = (typeof searchTypes)[number];

export const kindsByType: Readonly<Record<Exclude<SearchType, "all">, readonly SearchKind[]>> = {
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

export function isSearchType(value: string): value is SearchType {
  return (searchTypes as readonly string[]).includes(value);
}
