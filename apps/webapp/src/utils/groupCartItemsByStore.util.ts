import type { CartItem, Money, StoreSummary } from "@/types";

import { multiplyMoneyByQuantity } from "./formatMoney.util";

export interface CartStoreGroup {
  readonly storeId: string;
  readonly store: StoreSummary | null;
  readonly items: readonly CartItem[];
  readonly itemCount: number;
  readonly subtotal: Money;
}

export function groupCartItemsByStore(items: readonly CartItem[]): CartStoreGroup[] {
  const groups = new Map<string, { store: StoreSummary | null; items: CartItem[] }>();
  for (const item of items) {
    const storeId = item.store?.id ?? "unknown";
    const group = groups.get(storeId) ?? { store: item.store ?? null, items: [] };
    group.items.push(item);
    groups.set(storeId, group);
  }
  return [...groups.entries()].map(([storeId, group]) => {
    const first = group.items[0]!;
    const subtotalMinor = group.items.reduce((total, item) => total + multiplyMoneyByQuantity(item.product.price, item.quantity).amountMinor, 0);
    return {
      storeId,
      store: group.store,
      items: group.items,
      itemCount: group.items.reduce((total, item) => total + item.quantity, 0),
      subtotal: { amountMinor: subtotalMinor, currency: first.product.price.currency },
    };
  });
}
