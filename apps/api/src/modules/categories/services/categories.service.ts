import { notFound } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { CategoryRecord } from "../models/categories.model.js";
import type { CategoriesRepository } from "../repositories/categories.repository.js";

export class CategoriesService {
  public constructor(public readonly categories: CategoriesRepository, public readonly audit: AuditRecorder) {}

  public async findCategoryOrThrow(id: string): Promise<CategoryRecord> {
    const category = await this.categories.findById(id);
    if (category === undefined) throw notFound("Category");
    return category;
  }
}
