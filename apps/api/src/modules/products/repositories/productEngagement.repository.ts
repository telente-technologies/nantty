export type ProductEngagementKind = "like" | "bookmark";

export interface ProductEngagementRepository {
  add(kind: ProductEngagementKind, productId: string, userId: string): Promise<void>;
  remove(kind: ProductEngagementKind, productId: string, userId: string): Promise<void>;
  listEngagedProductIds(kind: ProductEngagementKind, userId: string, productIds: readonly string[]): Promise<ReadonlySet<string>>;
  countForProduct(kind: ProductEngagementKind, productId: string): Promise<number>;
}

export class InMemoryProductEngagementRepository implements ProductEngagementRepository {
  private readonly engagements = new Set<string>();

  public async add(kind: ProductEngagementKind, productId: string, userId: string): Promise<void> {
    this.engagements.add(`${kind}:${productId}:${userId}`);
  }

  public async remove(kind: ProductEngagementKind, productId: string, userId: string): Promise<void> {
    this.engagements.delete(`${kind}:${productId}:${userId}`);
  }

  public async listEngagedProductIds(kind: ProductEngagementKind, userId: string, productIds: readonly string[]): Promise<ReadonlySet<string>> {
    return new Set(productIds.filter((productId) => this.engagements.has(`${kind}:${productId}:${userId}`)));
  }

  public async countForProduct(kind: ProductEngagementKind, productId: string): Promise<number> {
    return [...this.engagements].filter((key) => key.startsWith(`${kind}:${productId}:`)).length;
  }
}
