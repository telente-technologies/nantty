import { ConflictError } from "@zudojs/errors";

import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { CategoryFields, CategoryRecord } from "../models/categories.model.js";
import type { CategoriesRepository } from "./categories.repository.js";

function convertUniqueViolationToConflict(error: unknown): never {
  if (isUniqueConstraintViolation(error)) throw new ConflictError("A category with this slug already exists.");
  throw error;
}

export class PrismaCategoriesRepository implements CategoriesRepository {
  public async listAll(): Promise<readonly CategoryRecord[]> {
    return prisma().category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  }

  public async findById(id: string): Promise<CategoryRecord | undefined> {
    return (await prisma().category.findUnique({ where: { id } })) ?? undefined;
  }

  public async findBySlug(slug: string): Promise<CategoryRecord | undefined> {
    return (await prisma().category.findUnique({ where: { slug } })) ?? undefined;
  }

  public async create(fields: CategoryFields): Promise<CategoryRecord> {
    try {
      return await prisma().category.create({ data: { ...fields } });
    } catch (error) {
      return convertUniqueViolationToConflict(error);
    }
  }

  public async update(id: string, changes: Partial<CategoryFields>): Promise<CategoryRecord | undefined> {
    try {
      const result = await prisma().category.updateMany({ where: { id }, data: { ...changes } });
      return result.count === 0 ? undefined : this.findById(id);
    } catch (error) {
      return convertUniqueViolationToConflict(error);
    }
  }

  public async delete(id: string): Promise<boolean> {
    return (await prisma().category.deleteMany({ where: { id } })).count > 0;
  }
}
