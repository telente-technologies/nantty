import { randomUUID } from "node:crypto";

import { ConflictError } from "@zudojs/errors";

import { DEFAULT_CATEGORIES } from "../../../constants/seedData.constant.js";
import type { CategoryFields, CategoryRecord } from "../models/categories.model.js";

export interface CategoriesRepository {
  listAll(): Promise<readonly CategoryRecord[]>;
  findById(id: string): Promise<CategoryRecord | undefined>;
  findBySlug(slug: string): Promise<CategoryRecord | undefined>;
  create(fields: CategoryFields): Promise<CategoryRecord>;
  update(id: string, changes: Partial<CategoryFields>): Promise<CategoryRecord | undefined>;
  delete(id: string): Promise<boolean>;
}

export function sortCategoriesForDisplay(categories: readonly CategoryRecord[]): readonly CategoryRecord[] {
  return [...categories].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}

export class InMemoryCategoriesRepository implements CategoriesRepository {
  private readonly categories = new Map<string, CategoryRecord>(
    DEFAULT_CATEGORIES.map((category, sortOrder) => {
      const record: CategoryRecord = { ...category, id: randomUUID(), parentId: null, imageUrl: null, sortOrder };
      return [record.id, record];
    }),
  );

  public async listAll(): Promise<readonly CategoryRecord[]> {
    return sortCategoriesForDisplay([...this.categories.values()]);
  }

  public async findById(id: string): Promise<CategoryRecord | undefined> {
    return this.categories.get(id);
  }

  public async findBySlug(slug: string): Promise<CategoryRecord | undefined> {
    return [...this.categories.values()].find((category) => category.slug === slug);
  }

  public async create(fields: CategoryFields): Promise<CategoryRecord> {
    this.assertSlugIsFree(fields.slug, undefined);
    const record: CategoryRecord = { ...fields, id: randomUUID() };
    this.categories.set(record.id, record);
    return record;
  }

  public async update(id: string, changes: Partial<CategoryFields>): Promise<CategoryRecord | undefined> {
    const existing = this.categories.get(id);
    if (existing === undefined) return undefined;
    if (changes.slug !== undefined) this.assertSlugIsFree(changes.slug, id);
    const updated = { ...existing, ...changes };
    this.categories.set(id, updated);
    return updated;
  }

  public async delete(id: string): Promise<boolean> {
    return this.categories.delete(id);
  }

  private assertSlugIsFree(slug: string, exceptId: string | undefined): void {
    if ([...this.categories.values()].some((category) => category.slug === slug && category.id !== exceptId)) {
      throw new ConflictError("A category with this slug already exists.");
    }
  }
}
