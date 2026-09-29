import { FigmaIconTintedWithCurrentColor } from "./figmaIcon";
import { LocalCurrencySymbol } from "./localCurrencySymbol";
import styles from "./sellerWalletPreviewCard.module.css";

const exampleWalletRows = [
  { label: "Held in escrow", note: "Orders on the way to buyers" },
  { label: "Available to withdraw", note: "Buyers confirmed delivery" },
] as const;

export function SellerWalletPreviewCard({ className }: { readonly className?: string }) {
  return (
    <figure className={className ? `${styles.card} ${className}` : styles.card}>
      <figcaption className={styles.caption}>
        <FigmaIconTintedWithCurrentColor name="speedometer24" size={18} />
        Seller wallet
        <span className={styles.hiddenBalanceNote}>
          <FigmaIconTintedWithCurrentColor name="eyeClosed20" size={16} />
          Hidden
        </span>
      </figcaption>
      <dl className={styles.rows}>
        {exampleWalletRows.map((walletRow) => (
          <div key={walletRow.label} className={styles.row}>
            <dt className={styles.rowLabel}>{walletRow.label}</dt>
            <dd className={styles.rowAmount}>
              <LocalCurrencySymbol />
              <span aria-label="hidden amount">••••••</span>
            </dd>
            <dd className={styles.rowNote}>{walletRow.note}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.payoutButton} aria-hidden="true">
        Withdraw to bank
      </p>
    </figure>
  );
}
