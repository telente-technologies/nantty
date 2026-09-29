import { randomUUID } from "node:crypto";

import type { NewVariantInput, ProductVariantRecord, VariantChanges } from "../models/products.model.js";

export interface ProductVariantsRepository {
  createMany(productId: string, variants: readonly NewVariantInput[]): Promise<readonly ProductVariantRecord[]>;
  findById(id: string): Promise<ProductVariantRecord | undefined>;
  findManyByIds(ids: readonly string[]): Promise<readonly ProductVariantRecord[]>;
  listForProducts(productIds: readonly string[]): Promise<readonly ProductVariantRecord[]>;
  update(id: string, changes: VariantChanges): Promise<ProductVariantRecord | undefined>;
  adjustStockBy(id: string, delta: number): Promise<ProductVariantRecord | undefined>;
  decrementStockIfAvailable(id: string, quantity: number): Promise<boolean>;
  incrementStock(id: string, quantity: number): Promise<void>;
}

export class InMemoryProductVariantsRepository implements ProductVariantsRepository {
  private readonly variants = new Map<string, ProductVariantRecord>();

  public async createMany(productId: string, variants: readonly NewVariantInput[]): Promise<readonly ProductVariantRecord[]> {
    const created = variants.map((variant, index): ProductVariantRecord => ({
      ...variant, id: randomUUID(), productId, createdAt: new Date(Date.now() + index),
    }));
    for (const variant of created) this.variants.set(variant.id, variant);
    return created;
  }

  public async findById(id: string): Promise<ProductVariantRecord | undefined> {
    return this.variants.get(id);
  }

  public async findManyByIds(ids: readonly string[]): Promise<readonly ProductVariantRecord[]> {
    return ids.map((id) => this.variants.get(id)).filter((variant): variant is ProductVariantRecord => variant !== undefined);
  }

  public async listForProducts(productIds: readonly string[]): Promise<readonly ProductVariantRecord[]> {
    return [...this.variants.values()]
      .filter((variant) => productIds.includes(variant.productId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  public async update(id: string, changes: VariantChanges): Promise<ProductVariantRecord | undefined> {
    const variant = this.variants.get(id);
    if (variant === undefined) return undefined;
    const updated = { ...variant, ...changes };
    this.variants.set(id, updated);
    return updated;
  }

  public async adjustStockBy(id: string, delta: number): Promise<ProductVariantRecord | undefined> {
    const variant = this.variants.get(id);
    if (variant === undefined || variant.stock + delta < 0) return undefined;
    const updated = { ...variant, stock: variant.stock + delta };
    this.variants.set(id, updated);
    return updated;
  }

  public async decrementStockIfAvailable(id: string, quantity: number): Promise<boolean> {
    return (await this.adjustStockBy(id, -quantity)) !== undefined;
  }

  public async incrementStock(id: string, quantity: number): Promise<void> {
    await this.adjustStockBy(id, quantity);
  }
}
