export function orderSummariesByIds<T extends { readonly id: string }>(ids: readonly string[], summaries: readonly T[]): T[] {
  const byId = new Map(summaries.map((summary) => [summary.id, summary]));
  return ids.map((id) => byId.get(id)).filter((summary): summary is T => summary !== undefined);
}
