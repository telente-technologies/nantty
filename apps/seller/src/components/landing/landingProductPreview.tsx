import styles from "./landingProductPreview.module.css";

const previewRows = ["Orders ready to fulfil", "Stock and product health", "Sales and payout activity"];

export function LandingProductPreview({ title }: { readonly title: string }) {
  return (
    <div className={styles.preview} role="img" aria-label={`${title} preview for Nantty Dashboard`}>
      <div className={styles.topline}><span className={styles.mark}>N</span><strong>Nantty Dashboard</strong><span className={styles.status}>Preview</span></div>
      <div className={styles.content}>
        <p className={styles.kicker}>BUSINESS OVERVIEW</p>
        <h4>{title}</h4>
        <div className={styles.metrics}><div><span>Today&apos;s sales</span><strong>₦284,500</strong></div><div><span>Orders</span><strong>24</strong></div></div>
        <ul>{previewRows.map((row, index) => <li key={row}><span className={styles.dot} />{row}<span className={styles.value}>{["8", "92%", "Updated"][index]}</span></li>)}</ul>
      </div>
    </div>
  );
}
