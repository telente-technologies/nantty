import type { SearchDocument } from "../../../types/searchDocument.type.js";
import { normalizeSearchText } from "../../../utils/queryNormalizer.util.js";

export function buildNormalizedTitle(document: Pick<SearchDocument, "kind" | "title" | "subtitle">): string {
  const joined = document.kind === "user" ? `${document.title} ${document.subtitle ?? ""}` : document.title;
  return normalizeSearchText(joined).replace(/^[#@]+/, "");
}
