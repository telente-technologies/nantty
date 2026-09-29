import type { AdPolicyCategoryRecord } from "../models/adCampaigns.model.js";

export type NewAdPolicyCategoryInput = Omit<AdPolicyCategoryRecord, "rejectionCount" | "createdAt" | "updatedAt">;
export type AdPolicyCategoryChanges = Partial<Pick<AdPolicyCategoryRecord, "name" | "description" | "severity" | "isActive">>;

export interface AdPoliciesRepository {
  listCategories(): Promise<readonly AdPolicyCategoryRecord[]>;
  findCategory(id: string): Promise<AdPolicyCategoryRecord | undefined>;
  createCategory(input: NewAdPolicyCategoryInput, now: Date): Promise<AdPolicyCategoryRecord | undefined>;
  updateCategory(id: string, changes: AdPolicyCategoryChanges, now: Date): Promise<AdPolicyCategoryRecord>;
  incrementRejections(id: string): Promise<void>;
}

export class InMemoryAdPoliciesRepository implements AdPoliciesRepository {
  private readonly categories = new Map<string, AdPolicyCategoryRecord>();

  public async listCategories(): Promise<readonly AdPolicyCategoryRecord[]> {
    return [...this.categories.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  public async findCategory(id: string): Promise<AdPolicyCategoryRecord | undefined> {
    return this.categories.get(id);
  }

  public async createCategory(input: NewAdPolicyCategoryInput, now: Date): Promise<AdPolicyCategoryRecord | undefined> {
    const lowerName = input.name.toLowerCase();
    if (this.categories.has(input.id) || [...this.categories.values()].some((category) => category.name.toLowerCase() === lowerName)) return undefined;
    const category = { ...input, rejectionCount: 0, createdAt: now, updatedAt: now };
    this.categories.set(category.id, category);
    return category;
  }

  public async updateCategory(id: string, changes: AdPolicyCategoryChanges, now: Date): Promise<AdPolicyCategoryRecord> {
    const category = this.categories.get(id);
    if (category === undefined) throw new Error(`Policy category ${id} does not exist.`);
    const updated = { ...category, ...changes, updatedAt: now };
    this.categories.set(id, updated);
    return updated;
  }

  public async incrementRejections(id: string): Promise<void> {
    const category = this.categories.get(id);
    if (category !== undefined) this.categories.set(id, { ...category, rejectionCount: category.rejectionCount + 1 });
  }
}
