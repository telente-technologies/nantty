import { notFound, unprocessable } from "../../../errors/domain.error.js";
import type { ProductCatalog, PurchasableVariant } from "../../../interfaces/productCatalog.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";
import { MAXIMUM_CART_LINE_QUANTITY } from "../models/carts.model.js";
import type { CartsRepository } from "../repositories/carts.repository.js";
import {
  calculateCartTotalsInKobo,
  priceCartLine,
  priceStoreGroup,
  type CartTotals,
  type PricedCartLine,
  type PricedStoreGroup,
} from "./cartPricing.service.js";

export interface CartsDependencies {
  readonly carts: CartsRepository;
  readonly productCatalog: ProductCatalog;
  readonly storeAccess: StoreAccess;
  readonly currency: string;
}

export interface PricedCart {
  readonly groups: readonly PricedStoreGroup[];
  readonly unavailableLines: readonly PricedCartLine[];
  readonly totals: CartTotals;
}

export class CartsService {
  public constructor(public readonly dependencies: CartsDependencies) {}

  public async buildPricedCartForUser(userId: string): Promise<PricedCart> {
    const { carts, productCatalog, storeAccess, currency } = this.dependencies;
    const lines = await carts.listForUser(userId);
    const variants = new Map((await productCatalog.findPurchasableVariants(lines.map((line) => line.variantId))).map((variant) => [variant.variantId, variant]));
    const pricedLines = lines.flatMap((line) => {
      const variant = variants.get(line.variantId);
      return variant === undefined ? [] : [priceCartLine(variant, line.quantity)];
    });
    const stores = new Map((await storeAccess.findStoreSummaries([...new Set(pricedLines.map((line) => line.variant.storeId))])).map((store) => [store.id, store]));
    const isAvailable = (line: PricedCartLine) =>
      line.variant.purchasable && stores.get(line.variant.storeId)?.status === "active" && line.quantity <= line.variant.stock;
    const groups = [...stores.values()]
      .map((store) => priceStoreGroup(store, pricedLines.filter((line) => line.variant.storeId === store.id && isAvailable(line))))
      .filter((group) => group.lines.length > 0);
    return { groups, unavailableLines: pricedLines.filter((line) => !isAvailable(line)), totals: calculateCartTotalsInKobo(groups, currency) };
  }

  public async addItemToCart(userId: string, variantId: string, quantity: number): Promise<void> {
    const existing = await this.dependencies.carts.findLine(userId, variantId);
    await this.saveValidatedQuantity(userId, variantId, (existing?.quantity ?? 0) + quantity);
  }

  public async changeCartItemQuantity(userId: string, variantId: string, quantity: number): Promise<void> {
    if ((await this.dependencies.carts.findLine(userId, variantId)) === undefined) throw notFound("Cart item");
    await this.saveValidatedQuantity(userId, variantId, quantity);
  }

  public async removeItemFromCart(userId: string, variantId: string): Promise<void> {
    if (!(await this.dependencies.carts.removeLine(userId, variantId))) throw notFound("Cart item");
  }

  public clearCart(userId: string): Promise<void> {
    return this.dependencies.carts.clear(userId);
  }

  private async saveValidatedQuantity(userId: string, variantId: string, quantity: number): Promise<void> {
    const variant = await this.findPurchasableVariantOrThrow(variantId);
    if (quantity < 1 || quantity > MAXIMUM_CART_LINE_QUANTITY) throw unprocessable(`Quantity must be between 1 and ${MAXIMUM_CART_LINE_QUANTITY}.`);
    if (quantity > variant.stock) throw unprocessable(`Only ${variant.stock} left in stock.`);
    await this.dependencies.carts.saveLineQuantity(userId, variantId, quantity);
  }

  private async findPurchasableVariantOrThrow(variantId: string): Promise<PurchasableVariant> {
    const [variant] = await this.dependencies.productCatalog.findPurchasableVariants([variantId]);
    if (variant === undefined || !variant.purchasable) throw notFound("Product");
    return variant;
  }
}
