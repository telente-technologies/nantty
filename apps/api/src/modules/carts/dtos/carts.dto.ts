import type { PricedCartLine, PricedStoreGroup } from "../services/cartPricing.service.js";
import type { DisplayCart } from "../services/carts.service.js";

function convertCartLineToDto(line: PricedCartLine, available: boolean) {
  return {
    id: line.cartItemId,
    product: { id: line.variant.productId, name: line.variant.title, price: line.unitPrice.toDto(), imageUrl: line.variant.imageUrl, stock: line.variant.stock },
    quantity: line.quantity,
    variant: { id: line.variant.variantId, size: line.variant.size, color: line.variant.color },
    storeId: line.variant.storeId,
    lineTotal: line.lineTotal.toDto(),
    available,
  };
}

function convertStoreGroupToDto(group: PricedStoreGroup) {
  return {
    store: { id: group.store.id, name: group.store.name, logoUrl: group.store.logoUrl, currency: group.store.currency },
    itemIds: group.lines.map((line) => line.cartItemId),
    itemsTotal: group.itemsTotal.toDto(),
    shopDiscount: group.shopDiscount.toDto(),
    shipping: group.shipping.toDto(),
    total: group.total.toDto(),
  };
}

export function convertDisplayCartToDto(cart: DisplayCart) {
  return {
    items: [
      ...cart.groups.flatMap((group) => group.lines.map((line) => convertCartLineToDto(line, true))),
      ...cart.unavailableLines.map((line) => convertCartLineToDto(line, false)),
    ],
    itemsTotal: cart.totals.itemsTotal.toDto(),
    shopDiscount: cart.totals.shopDiscount.toDto(),
    shipping: cart.totals.shipping.toDto(),
    total: cart.totals.estimatedTotal.toDto(),
    displayCurrency: cart.displayCurrency,
    stores: cart.groups.map(convertStoreGroupToDto),
  };
}
