export interface CatalogProductSummary {
  readonly id: string;
  readonly name: string;
  readonly price: { readonly amountMinor: number; readonly currency: string };
  readonly imageUrl: string | null;
  readonly stock: number;
  readonly storeId: string;
  readonly taggable: boolean;
}

export interface ProductCatalog {
  findProducts(productIds: readonly string[]): Promise<ReadonlyMap<string, CatalogProductSummary>>;
}
