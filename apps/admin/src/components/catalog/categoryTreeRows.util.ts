import type { CatalogCategory } from "@/types/catalog.type";

export interface CategoryTreeRow {
  readonly category: CatalogCategory;
  readonly depth: number;
  readonly isFirstSibling: boolean;
  readonly isLastSibling: boolean;
  readonly parentName: string | null;
}

export function flattenCategoriesIntoTreeRows(categories: readonly CatalogCategory[]): CategoryTreeRow[] {
  const bySortOrder = (first: CatalogCategory, second: CatalogCategory) => first.sortOrder - second.sortOrder;
  const topLevel = categories.filter((category) => category.parentId === null).sort(bySortOrder);
  const rows: CategoryTreeRow[] = [];
  topLevel.forEach((parent, parentIndex) => {
    rows.push({ category: parent, depth: 0, isFirstSibling: parentIndex === 0, isLastSibling: parentIndex === topLevel.length - 1, parentName: null });
    const children = categories.filter((category) => category.parentId === parent.id).sort(bySortOrder);
    children.forEach((child, childIndex) => rows.push({ category: child, depth: 1, isFirstSibling: childIndex === 0, isLastSibling: childIndex === children.length - 1, parentName: parent.name }));
  });
  return rows;
}

export function filterCategoryTreeRowsBySearch(rows: readonly CategoryTreeRow[], searchText: string): CategoryTreeRow[] {
  const needle = searchText.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.filter((row) => row.category.name.toLowerCase().includes(needle) || row.category.slug.includes(needle) || (row.parentName ?? "").toLowerCase().includes(needle));
}
