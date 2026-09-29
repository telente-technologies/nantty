import { ConflictError } from "@zudojs/errors";

import type {
  InventoryLine,
  ProductCatalog,
  ProductSummary,
  PurchasableVariant,
  StockLine,
} from "../../../interfaces/productCatalog.interface.js";
import type { ProductsService } from "./products.service.js";

function combineStockLinesByVariant(lines: readonly StockLine[]): readonly StockLine[] {
  const totals = new Map<string, number>();
  for (const line of lines) totals.set(line.variantId, (totals.get(line.variantId) ?? 0) + line.quantity);
  return [...totals].map(([variantId, quantity]) => ({ variantId, quantity }));
}

export class RepositoryProductCatalog implements ProductCatalog {
  public constructor(private readonly productsService: ProductsService) {}

  public async findPurchasableVariants(variantIds: readonly string[]): Promise<readonly PurchasableVariant[]> {
    const { variants, products, stores } = this.productsService.dependencies;
    const foundVariants = await variants.findManyByIds([...new Set(variantIds)]);
    const foundProducts = new Map((await products.findManyByIds([...new Set(foundVariants.map((variant) => variant.productId))])).map((product) => [product.id, product]));
    const activeStoreIds = new Set(
      (await stores.findManyByIds([...new Set([...foundProducts.values()].map((product) => product.storeId))]))
        .filter((store) => store.status === "active")
        .map((store) => store.id),
    );
    return foundVariants.flatMap((variant) => {
      const product = foundProducts.get(variant.productId);
      if (product === undefined) return [];
      return [{
        variantId: variant.id,
        productId: product.id,
        storeId: product.storeId,
        title: product.title,
        size: variant.size,
        color: variant.color,
        imageUrl: product.images[0] ?? null,
        unitPrice: variant.price,
        currency: product.currency,
        stock: variant.stock,
        purchasable: product.status === "published" && activeStoreIds.has(product.storeId),
      }];
    });
  }

  public async reserveStock(lines: readonly StockLine[]): Promise<void> {
    const { variants } = this.productsService.dependencies;
    const reserved: StockLine[] = [];
    for (const line of combineStockLinesByVariant(lines)) {
      if (!(await variants.decrementStockIfAvailable(line.variantId, line.quantity))) {
        await this.releaseStock(reserved);
        throw new ConflictError("insufficient stock");
      }
      reserved.push(line);
    }
  }

  public async releaseStock(lines: readonly StockLine[]): Promise<void> {
    for (const line of combineStockLinesByVariant(lines)) {
      await this.productsService.dependencies.variants.incrementStock(line.variantId, line.quantity);
    }
  }

  public async recordSales(lines: readonly { readonly productId: string; readonly quantity: number }[]): Promise<void> {
    for (const line of lines) await this.productsService.dependencies.products.incrementSalesCount(line.productId, line.quantity);
  }

  public async findProductSummaries(productIds: readonly string[]): Promise<readonly ProductSummary[]> {
    const products = await this.productsService.dependencies.products.findManyByIds([...new Set(productIds)]);
    return products.map((product) => ({
      id: product.id,
      storeId: product.storeId,
      title: product.title,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      imageUrl: product.images[0] ?? null,
      ratingAverage: product.ratingAverage,
      ratingCount: product.ratingCount,
      currency: product.currency,
      published: product.status === "published",
    }));
  }

  public listInventoryForStore(storeId: string): Promise<readonly InventoryLine[]> {
    return this.productsService.buildInventoryLinesForStore(storeId);
  }

  public updateProductRating(productId: string, ratingAverage: number, ratingCount: number): Promise<void> {
    return this.productsService.dependencies.products.updateRating(productId, ratingAverage, ratingCount);
  }
}
