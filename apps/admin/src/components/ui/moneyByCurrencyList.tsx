import type { Money } from "@/types/api.type";
import { formatMoneyForDisplay } from "@/utils/formatting.util";

import styles from "./moneyByCurrencyList.module.css";

export function MoneyByCurrencyList({ amounts, isCompact = true }: { readonly amounts: readonly Money[]; readonly isCompact?: boolean }) {
  if (amounts.length === 0) return <span className={styles.none}>None</span>;
  const [primary, ...others] = amounts;
  return (
    <span className={styles.list}>
      <span className={styles.primary}>{formatMoneyForDisplay(primary, { compact: isCompact })}</span>
      {others.map((amount) => (
        <span key={amount.currency} className={styles.secondary}>
          {formatMoneyForDisplay(amount, { compact: isCompact })} <span className={styles.code}>{amount.currency}</span>
        </span>
      ))}
    </span>
  );
}
