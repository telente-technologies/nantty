import type { PricedCartLine, PricedStoreGroup } from "../services/cartPricing.service.js";
import type { PricedCart } from "../services/carts.service.js";

function convertCartLineToDto(line: PricedCartLine) {
  return {
    variantId: line.variant.variantId,
    productId: line.variant.productId,
    storeId: line.variant.storeId,
    title: line.variant.title,
    size: line.variant.size,
    color: line.variant.color,
    imageUrl: line.variant.imageUrl,
    unitPrice: line.variant.unitPrice,
    quantity: line.quantity,
    lineTotal: line.lineTotal,
    inStock: line.variant.stock,
  };
}

function convertStoreGroupToDto(group: PricedStoreGroup) {
  return {
    store: {
      id: group.store.id,
      name: group.store.name,
      slug: group.store.slug,
      logoUrl: group.store.logoUrl,
      ratingAverage: group.store.ratingAverage,
      ratingCount: group.store.ratingCount,
    },
    items: group.lines.map(convertCartLineToDto),
    itemsTotal: group.itemsTotal,
    shopDiscount: group.shopDiscount,
    shipping: group.shipping,
    total: group.total,
  };
}

export function convertPricedCartToDto(cart: PricedCart) {
  return {
    stores: cart.groups.map(convertStoreGroupToDto),
    unavailableItems: cart.unavailableLines.map(convertCartLineToDto),
    summary: cart.totals,
  };
}
