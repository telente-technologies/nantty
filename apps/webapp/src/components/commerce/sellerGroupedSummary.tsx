import { Avatar } from "@/components/ui/media";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { groupCartItemsByStore } from "@/utils/groupCartItemsByStore.util";
import type { CartItem, CartShippingQuote, SellerShippingQuote } from "@/types";

import styles from "./sellerGroupedSummary.module.css";

function describeShipping(quote: SellerShippingQuote | undefined): string {
  if (!quote || quote.status === "needsAddress") return "Add an address for shipping";
  if (quote.status === "notDeliverable") return quote.message ?? "Does not ship to this address";
  if (quote.isFree) return "Free shipping";
  const shipping = quote.fee ? `Shipping ${formatMoneyForDisplay(quote.fee)}` : "Shipping";
  return quote.amountToFreeShipping ? `${shipping} · add ${formatMoneyForDisplay(quote.amountToFreeShipping)} more for free shipping` : shipping;
}

export function SellerGroupedSummary({ items, quote }: { readonly items: readonly CartItem[]; readonly quote?: CartShippingQuote | null }) {
  const groups = groupCartItemsByStore(items);
  return (
    <ul className={styles.list} aria-label="Totals by seller">
      {groups.map((group) => (
        <li key={group.storeId} className={styles.row}>
          <Avatar name={group.store?.name ?? "Seller"} src={group.store?.logoUrl ?? null} size="xs" />
          <span className={styles.text}>
            <span className={styles.name}>{group.store?.name ?? "Seller"}</span>
            <span className={styles.meta}>
              {group.itemCount} {group.itemCount === 1 ? "item" : "items"} · ships separately
            </span>
            <span className={[styles.meta, quote?.groups.find((entry) => entry.storeId === group.storeId)?.status === "notDeliverable" ? styles.warn : ""].filter(Boolean).join(" ")}>
              {describeShipping(quote?.groups.find((entry) => entry.storeId === group.storeId))}
            </span>
          </span>
          <span className={styles.amount}>{formatMoneyForDisplay(group.subtotal)}</span>
        </li>
      ))}
    </ul>
  );
}
