import { FigmaIconTintedWithCurrentColor } from "./figmaIcon";
import { LocalCurrencySymbol } from "./localCurrencySymbol";
import styles from "./sellerWalletPreviewCard.module.css";

const exampleWalletRows = [
  { label: "Pending in escrow", note: "Order funds held by our payment partner" },
  { label: "Available to withdraw", note: "After payout verification and order release" },
] as const;

export function SellerWalletPreviewCard({ className }: { readonly className?: string }) {
  return (
    <figure className={className ? `${styles.card} ${className}` : styles.card} aria-label="Illustrative seller wallet preview">
      <figcaption className={styles.caption}>
        <FigmaIconTintedWithCurrentColor name="bank24" size={18} />
        <span className={styles.captionTitle}>Seller wallet</span>
        <span className={styles.previewTag}>Preview</span>
        <span className={styles.hiddenBalanceNote} aria-label="Example balances are hidden">
          <FigmaIconTintedWithCurrentColor name="eyeClosed20" size={16} />
          Example
        </span>
      </figcaption>
      <p className={styles.intro}>A clearer view of what is ready to withdraw and what is still tied to an order.</p>
      <dl className={styles.rows}>
        {exampleWalletRows.map((walletRow) => (
          <div key={walletRow.label} className={styles.row}>
            <dt className={styles.rowLabel}>{walletRow.label}</dt>
            <dd className={styles.rowAmount} aria-label="Illustrative balance hidden">
              <LocalCurrencySymbol />
              <span>••••••</span>
            </dd>
            <dd className={styles.rowNote}>{walletRow.note}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.disclaimer}>Illustrative only — not a live account or balance. Withdrawal eligibility depends on the applicable payout and order rules.</p>
    </figure>
  );
}
