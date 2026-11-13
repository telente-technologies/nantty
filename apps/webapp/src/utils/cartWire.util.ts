import type { Cart, CartItem, CartShippingQuote, Money, SellerShippingQuote, ShippingQuoteStatus, StoreSummary } from "@/types";

interface StoreWire {
  readonly id: string;
  readonly name: string;
  readonly logoUrl?: string | null;
  readonly rating?: number;
  readonly ratingCount?: number;
  readonly successRate?: number | null;
}

interface GroupShippingWire {
  readonly status: ShippingQuoteStatus;
  readonly fee: Money | null;
  readonly message: string | null;
  readonly isFree: boolean;
  readonly amountToFreeShipping: Money | null;
}

interface GroupWire {
  readonly storeId: string;
  readonly storeName?: string;
  readonly store?: StoreWire | null;
  readonly shipping?: GroupShippingWire | null;
}

export interface CartWire extends Cart {
  readonly addressId?: string | null;
  readonly shippingQuoteRevision?: string | null;
  readonly items: readonly (CartItem & { readonly storeId?: string })[];
  readonly groups?: readonly GroupWire[];
}

function toStoreSummary(group: GroupWire): StoreSummary {
  const store = group.store;
  return {
    id: group.storeId,
    name: store?.name ?? group.storeName ?? "Seller",
    logoUrl: store?.logoUrl ?? null,
    rating: store?.rating ?? 0,
    ratingCount: store?.ratingCount ?? 0,
    reviewCount: store?.ratingCount ?? 0,
    successRate: store?.successRate ?? null,
  };
}

export function readCartFromWire(wire: CartWire): Cart {
  const storesById = new Map((wire.groups ?? []).map((group) => [group.storeId, toStoreSummary(group)] as const));
  return { ...wire, items: wire.items.map((item) => ({ ...item, store: item.store ?? (item.storeId ? storesById.get(item.storeId) : undefined) ?? null })) };
}

function toSellerShippingQuote(group: GroupWire): SellerShippingQuote {
  const shipping = group.shipping;
  return {
    storeId: group.storeId,
    status: shipping?.status ?? "needsAddress",
    fee: shipping?.fee ?? null,
    isFree: shipping?.isFree ?? false,
    message: shipping?.message ?? null,
    amountToFreeShipping: shipping?.amountToFreeShipping ?? null,
  };
}

export function readShippingQuoteFromWire(wire: CartWire): CartShippingQuote {
  return {
    addressId: wire.addressId ?? null,
    shippingQuoteRevision: wire.shippingQuoteRevision ?? null,
    groups: (wire.groups ?? []).map(toSellerShippingQuote),
    unavailableItems: wire.unavailableItems,
    unavailableItemCount: wire.unavailableItemCount,
    payableGroupCount: wire.payableGroupCount,
    itemsTotal: wire.itemsTotal,
    shopDiscount: wire.shopDiscount,
    storeCredit: wire.storeCredit,
    shipping: wire.shipping,
    total: wire.total,
  };
}
