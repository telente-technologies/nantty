export function insertSponsoredItems<T>(organic: readonly T[], insertions: readonly { readonly position: number; readonly item: T }[]): T[] {
  const merged = [...organic];
  for (const insertion of [...insertions].sort((left, right) => left.position - right.position)) {
    merged.splice(Math.min(Math.max(0, insertion.position), merged.length), 0, insertion.item);
  }
  return merged;
}
