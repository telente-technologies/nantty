import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { paginateSortedItems } from "../../../utils/pagination.util.js";
import {
  compareProductsBySort,
  type NewProductInput,
  type PriceRange,
  type ProductChanges,
  type ProductRecord,
  type ProductStatus,
  type PublicProductFilter,
} from "../models/products.model.js";

export interface ProductsRepository {
  create(input: NewProductInput): Promise<ProductRecord>;
  findById(id: string): Promise<ProductRecord | undefined>;
  findManyByIds(ids: readonly string[]): Promise<readonly ProductRecord[]>;
  update(id: string, changes: ProductChanges): Promise<ProductRecord | undefined>;
  updateStatus(id: string, status: ProductStatus, publishedAt: Date | null): Promise<ProductRecord | undefined>;
  listPublished(filter: PublicProductFilter, page: PageRequest): Promise<Page<ProductRecord>>;
  listForStore(storeId: string, page: PageRequest): Promise<Page<ProductRecord>>;
  listAllActiveForStore(storeId: string): Promise<readonly ProductRecord[]>;
  listDiscountedPublished(excludedStoreIds: readonly string[], limit: number): Promise<readonly ProductRecord[]>;
  listRelatedPublished(product: ProductRecord, excludedStoreIds: readonly string[], limit: number): Promise<readonly ProductRecord[]>;
  countPublishedForStore(storeId: string): Promise<number>;
  countAllForStore(storeId: string): Promise<number>;
  incrementSalesCount(id: string, quantity: number): Promise<void>;
  updateRating(id: string, ratingAverage: number, ratingCount: number): Promise<void>;
}

function priceFallsInRange(product: ProductRecord, range: PriceRange): boolean {
  return product.currency === range.currency
    && (range.minPrice === undefined || product.price >= range.minPrice)
    && (range.maxPrice === undefined || product.price <= range.maxPrice);
}

function matchesPublicFilter(product: ProductRecord, filter: PublicProductFilter): boolean {
  const needle = filter.search?.toLowerCase();
  return product.status === "published"
    && !filter.excludedStoreIds.includes(product.storeId)
    && (filter.categoryId === undefined || product.categoryId === filter.categoryId)
    && (filter.storeId === undefined || product.storeId === filter.storeId)
    && (filter.priceRanges === undefined || filter.priceRanges.some((range) => priceFallsInRange(product, range)))
    && (needle === undefined || product.title.toLowerCase().includes(needle) || product.description.toLowerCase().includes(needle));
}

export class InMemoryProductsRepository implements ProductsRepository {
  private readonly products = new Map<string, ProductRecord>();

  public async create(input: NewProductInput): Promise<ProductRecord> {
    const now = new Date();
    const product: ProductRecord = {
      ...input, id: randomUUID(), status: "draft", featured: false, salesCount: 0, ratingAverage: 0, ratingCount: 0,
      publishedAt: null, createdAt: now, updatedAt: now,
    };
    this.products.set(product.id, product);
    return product;
  }

  public async findById(id: string): Promise<ProductRecord | undefined> {
    return this.products.get(id);
  }

  public async findManyByIds(ids: readonly string[]): Promise<readonly ProductRecord[]> {
    return ids.map((id) => this.products.get(id)).filter((product): product is ProductRecord => product !== undefined);
  }

  public async update(id: string, changes: ProductChanges): Promise<ProductRecord | undefined> {
    return this.patch(id, { ...changes });
  }

  public async updateStatus(id: string, status: ProductStatus, publishedAt: Date | null): Promise<ProductRecord | undefined> {
    return this.patch(id, { status, publishedAt });
  }

  public async listPublished(filter: PublicProductFilter, page: PageRequest): Promise<Page<ProductRecord>> {
    const matches = [...this.products.values()].filter((product) => matchesPublicFilter(product, filter)).sort(compareProductsBySort(filter.sort));
    return paginateSortedItems(matches, page);
  }

  public async listForStore(storeId: string, page: PageRequest): Promise<Page<ProductRecord>> {
    return paginateSortedItems([...(await this.listAllActiveForStore(storeId))].sort(compareProductsBySort("newest")), page);
  }

  public async listAllActiveForStore(storeId: string): Promise<readonly ProductRecord[]> {
    return [...this.products.values()].filter((product) => product.storeId === storeId && product.status !== "archived");
  }

  public async listDiscountedPublished(excludedStoreIds: readonly string[], limit: number): Promise<readonly ProductRecord[]> {
    return [...this.products.values()]
      .filter((product) => matchesPublicFilter(product, { sort: "newest", excludedStoreIds }) && product.compareAtPrice !== null)
      .sort(compareProductsBySort("newest"))
      .slice(0, limit);
  }

  public async listRelatedPublished(product: ProductRecord, excludedStoreIds: readonly string[], limit: number): Promise<readonly ProductRecord[]> {
    return [...this.products.values()]
      .filter((candidate) => candidate.id !== product.id && matchesPublicFilter(candidate, { sort: "popular", excludedStoreIds }))
      .filter((candidate) => (product.categoryId !== null && candidate.categoryId === product.categoryId) || candidate.storeId === product.storeId)
      .sort(compareProductsBySort("popular"))
      .slice(0, limit);
  }

  public async countPublishedForStore(storeId: string): Promise<number> {
    return [...this.products.values()].filter((product) => product.storeId === storeId && product.status === "published").length;
  }

  public async countAllForStore(storeId: string): Promise<number> {
    return [...this.products.values()].filter((product) => product.storeId === storeId).length;
  }

  public async incrementSalesCount(id: string, quantity: number): Promise<void> {
    const product = this.products.get(id);
    if (product !== undefined) this.products.set(id, { ...product, salesCount: product.salesCount + quantity });
  }

  public async updateRating(id: string, ratingAverage: number, ratingCount: number): Promise<void> {
    this.patch(id, { ratingAverage, ratingCount });
  }

  private patch(id: string, changes: Partial<ProductRecord>): ProductRecord | undefined {
    const product = this.products.get(id);
    if (product === undefined) return undefined;
    const updated: ProductRecord = { ...product, ...changes, updatedAt: new Date() };
    this.products.set(id, updated);
    return updated;
  }
}
