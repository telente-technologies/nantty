import type { ReceiptTemplate, StoreSettings } from "@/types/store.type";
import { formatMoneyForDisplay } from "@/utils/money.util";

import styles from "./receiptTemplatePreview.module.css";

const previewLines = [
  { name: "Sample item", quantity: 1, unitMinor: 1_850_000 },
  { name: "Another item", quantity: 2, unitMinor: 1_250_000 },
];

export function ReceiptTemplatePreview({ settings, template, cashierName }: { readonly settings: StoreSettings; readonly template: ReceiptTemplate; readonly cashierName: string }) {
  const currency = settings.currency;
  const totalMinor = previewLines.reduce((sum, line) => sum + line.quantity * line.unitMinor, 0);
  const formatMinor = (amountMinor: number) => formatMoneyForDisplay({ amountMinor, currency }, settings.locale);
  return (
    <figure className={styles.frame} aria-label={`Receipt preview at ${template.paperWidth}`}>
      <div className={`${styles.paper} ${template.paperWidth === "58mm" ? styles.narrow : styles.wide}`}>
        {template.showLogo ? <div className={styles.logo}>{settings.logoUrl ? "LOGO" : settings.name.slice(0, 1)}</div> : null}
        <p className={styles.storeName}>{settings.name}</p>
        <p className={styles.small}>{settings.address}</p>
        <p className={styles.small}>{settings.phone}</p>
        {template.headerText ? <p className={styles.centered}>{template.headerText}</p> : null}
        <hr className={styles.rule} />
        {previewLines.map((line) => (
          <div key={line.name} className={styles.line}>
            <span>
              {line.name} ×{line.quantity}
            </span>
            <span>{formatMinor(line.quantity * line.unitMinor)}</span>
          </div>
        ))}
        <hr className={styles.rule} />
        <div className={`${styles.line} ${styles.total}`}>
          <span>Total</span>
          <span>{formatMinor(totalMinor)}</span>
        </div>
        {template.showCashierName ? <p className={styles.small}>Served by {cashierName}</p> : null}
        {template.returnPolicy ? <p className={styles.small}>{template.returnPolicy}</p> : null}
        {template.footerText ? <p className={styles.centered}>{template.footerText}</p> : null}
      </div>
      <figcaption className={styles.caption}>{template.paperWidth} thermal paper</figcaption>
    </figure>
  );
}
