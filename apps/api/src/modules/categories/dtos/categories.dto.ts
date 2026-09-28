import type { CategoryRecord } from "../models/categories.model.js";

export interface CategoryDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly parentId: string | null;
  readonly imageUrl: string | null;
  readonly sortOrder: number;
}

export function convertCategoryToDto(category: CategoryRecord): CategoryDto {
  return { ...category };
}
