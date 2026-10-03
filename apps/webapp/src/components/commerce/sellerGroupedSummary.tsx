import { Avatar } from "@/components/ui/media";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { groupCartItemsByStore } from "@/utils/groupCartItemsByStore.util";
import type { CartItem } from "@/types";

import styles from "./sellerGroupedSummary.module.css";

export function SellerGroupedSummary({ items }: { readonly items: readonly CartItem[] }) {
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
          </span>
          <span className={styles.amount}>{formatMoneyForDisplay(group.subtotal)}</span>
        </li>
      ))}
    </ul>
  );
}
