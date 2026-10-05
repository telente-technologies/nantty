import type { MartHighlight } from "@/types/martHighlight.type";

const SESSION_SEED = Math.floor(Math.random() * 0x7fffffff);

const seededRank = (id: string, seed: number) => {
  let hash = seed >>> 0;
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 2654435761) >>> 0;
  return hash;
};

export function orderMartHighlightsForSession(highlights: readonly MartHighlight[], seed = SESSION_SEED): MartHighlight[] {
  const seen = new Set<string>();
  const unique = highlights.filter((highlight) => !seen.has(highlight.id) && seen.add(highlight.id));
  const boosted = unique.filter((highlight) => highlight.kind === "boosted_product").sort((left, right) => seededRank(left.id, seed) - seededRank(right.id, seed));
  return [...boosted, ...unique.filter((highlight) => highlight.kind !== "boosted_product")];
}
