import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { notFound, unprocessable } from "../../../errors/domain.error.js";
import type { CurrencyConverter } from "../../../interfaces/currencyConverter.interface.js";
import type { ProductCatalog, PurchasableVariant } from "../../../interfaces/productCatalog.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";
import { MAXIMUM_CART_LINE_QUANTITY } from "../models/carts.model.js";
import type { CartsRepository } from "../repositories/carts.repository.js";
import {
  calculateCartTotalsInDisplayCurrency,
  convertPricedStoreGroupInto,
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
  readonly currencyConverter: CurrencyConverter;
}

export interface ProductChoice {
  readonly productId: string;
  readonly size: string | undefined;
  readonly color: string | undefined;
  readonly quantity: number;
}

export interface PricedCart {
  readonly groups: readonly PricedStoreGroup[];
  readonly unavailableLines: readonly PricedCartLine[];
}

export interface DisplayCart {
  readonly displayCurrency: CurrencyCode;
  readonly groups: readonly PricedStoreGroup[];
  readonly unavailableLines: readonly PricedCartLine[];
  readonly totals: CartTotals;
}

export class CartsService {
  public constructor(public readonly dependencies: CartsDependencies) {}

  public async buildPricedCartForUser(userId: string): Promise<PricedCart> {
    const { carts, productCatalog, storeAccess } = this.dependencies;
    const lines = await carts.listForUser(userId);
    const variants = new Map((await productCatalog.findPurchasableVariants(lines.map((line) => line.variantId))).map((variant) => [variant.variantId, variant]));
    const pricedLines = lines.flatMap((line) => {
      const variant = variants.get(line.variantId);
      return variant === undefined ? [] : [priceCartLine(line.id, variant, line.quantity)];
    });
    const stores = new Map((await storeAccess.findStoreSummaries([...new Set(pricedLines.map((line) => line.variant.storeId))])).map((store) => [store.id, store]));
    const isAvailable = (line: PricedCartLine) =>
      line.variant.purchasable && stores.get(line.variant.storeId)?.status === "active" && stores.get(line.variant.storeId)?.currency === line.variant.currency && line.quantity <= line.variant.stock;
    const groups = [...stores.values()]
      .map((store) => priceStoreGroup(store, pricedLines.filter((line) => line.variant.storeId === store.id && isAvailable(line))))
      .filter((group) => group.lines.length > 0);
    return { groups, unavailableLines: pricedLines.filter((line) => !isAvailable(line)) };
  }

  public async buildDisplayCartForUser(userId: string, displayCurrency: CurrencyCode): Promise<DisplayCart> {
    const cart = await this.buildPricedCartForUser(userId);
    const convert = await this.dependencies.currencyConverter.prepareConversionInto(displayCurrency);
    const groups = cart.groups.map((group) => convertPricedStoreGroupInto(group, convert));
    return {
      displayCurrency,
      groups,
      unavailableLines: cart.unavailableLines.map((line) => ({ ...line, unitPrice: convert(line.unitPrice), lineTotal: convert(line.lineTotal) })),
      totals: calculateCartTotalsInDisplayCurrency(groups, displayCurrency),
    };
  }

  public async addProductToCart(userId: string, choice: ProductChoice): Promise<void> {
    const variantId = await this.findVariantIdMatchingChoice(choice);
    const existing = await this.dependencies.carts.findLine(userId, variantId);
    await this.saveValidatedQuantity(userId, variantId, (existing?.quantity ?? 0) + choice.quantity);
  }

  public async changeCartItemQuantity(userId: string, cartItemId: string, quantity: number): Promise<void> {
    const line = await this.findOwnedCartItemOrThrow(userId, cartItemId);
    await this.saveValidatedQuantity(userId, line.variantId, quantity);
  }

  public async removeItemFromCart(userId: string, cartItemId: string): Promise<void> {
    const line = await this.findOwnedCartItemOrThrow(userId, cartItemId);
    await this.dependencies.carts.removeLine(userId, line.variantId);
  }

  private async findOwnedCartItemOrThrow(userId: string, cartItemId: string) {
    const line = (await this.dependencies.carts.listForUser(userId)).find((candidate) => candidate.id === cartItemId);
    if (line === undefined) throw notFound("Cart item");
    return line;
  }

  private async findVariantIdMatchingChoice(choice: ProductChoice): Promise<string> {
    const variants = (await this.dependencies.productCatalog.listPurchasableVariantsForProduct(choice.productId)).filter((variant) => variant.purchasable);
    if (variants.length === 0) throw notFound("Product");
    const matching = variants.filter(
      (variant) =>
        (choice.size === undefined || variant.size?.toLowerCase() === choice.size.toLowerCase()) &&
        (choice.color === undefined || variant.color?.toLowerCase() === choice.color.toLowerCase()),
    );
    const [onlyMatch] = matching;
    if (matching.length === 1 && onlyMatch !== undefined) return onlyMatch.variantId;
    if (matching.length === 0) throw unprocessable("That size or colour is not available.");
    throw unprocessable("Choose a size and colour.");
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
