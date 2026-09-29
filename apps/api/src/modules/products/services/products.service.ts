import type { EventBus } from "@zudojs/events";

import { notFound } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { CurrencyConverter } from "../../../interfaces/currencyConverter.interface.js";
import type { InventoryLine } from "../../../interfaces/productCatalog.interface.js";
import type { CategoriesRepository } from "../../categories/repositories/categories.repository.js";
import type { StoresRepository } from "../../stores/repositories/stores.repository.js";
import type { StoreAccessService } from "../../stores/services/storeAccess.service.js";
import type { ProductRecord, ProductVariantRecord, ProductWithVariants } from "../models/products.model.js";
import type { ProductEngagementRepository } from "../repositories/productEngagement.repository.js";
import type { ProductVariantsRepository } from "../repositories/productVariants.repository.js";
import type { ProductsRepository } from "../repositories/products.repository.js";

export interface ProductsDependencies {
  readonly products: ProductsRepository;
  readonly variants: ProductVariantsRepository;
  readonly engagement: ProductEngagementRepository;
  readonly stores: StoresRepository;
  readonly categories: CategoriesRepository;
  readonly storeAccess: StoreAccessService;
  readonly events: EventBus;
  readonly audit: AuditRecorder;
  readonly currencyConverter: CurrencyConverter;
}

export class ProductsService {
  public constructor(public readonly dependencies: ProductsDependencies) {}

  public async findStoreProductForMember(userId: string, storeId: string, productId: string): Promise<ProductRecord> {
    await this.dependencies.storeAccess.assertStoreMember(userId, storeId);
    const product = await this.dependencies.products.findById(productId);
    if (product === undefined || product.storeId !== storeId || product.status === "archived") throw notFound("Product");
    return product;
  }

  public async findVariantOfProduct(productId: string, variantId: string): Promise<ProductVariantRecord> {
    const variant = await this.dependencies.variants.findById(variantId);
    if (variant === undefined || variant.productId !== productId) throw notFound("Product variant");
    return variant;
  }

  public async loadProductWithVariants(product: ProductRecord): Promise<ProductWithVariants> {
    return { product, variants: await this.dependencies.variants.listForProducts([product.id]) };
  }

  public async assertCategoryExists(categoryId: string | null | undefined): Promise<void> {
    if (categoryId === null || categoryId === undefined) return;
    if ((await this.dependencies.categories.findById(categoryId)) === undefined) throw notFound("Category");
  }

  public async findPubliclyVisibleProductOrThrow(productId: string): Promise<ProductRecord> {
    const product = await this.dependencies.products.findById(productId);
    if (product === undefined || product.status !== "published") throw notFound("Product");
    const store = await this.dependencies.stores.findById(product.storeId);
    if (store === undefined || store.status !== "active") throw notFound("Product");
    return product;
  }

  public listHiddenStoreIds(): Promise<readonly string[]> {
    return this.dependencies.stores.listSuspendedStoreIds();
  }

  public async buildInventoryLinesForStore(storeId: string): Promise<readonly InventoryLine[]> {
    const products = await this.dependencies.products.listAllActiveForStore(storeId);
    const titles = new Map(products.map((product) => [product.id, product.title]));
    const variants = await this.dependencies.variants.listForProducts(products.map((product) => product.id));
    return variants.map((variant) => ({
      productId: variant.productId,
      variantId: variant.id,
      title: titles.get(variant.productId) ?? "",
      size: variant.size,
      color: variant.color,
      stock: variant.stock,
    }));
  }
}
