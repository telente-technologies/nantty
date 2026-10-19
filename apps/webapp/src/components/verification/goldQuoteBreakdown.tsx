import type { GoldForBusinessesQuote } from "@/types/goldForBusinesses.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { buildGoldQuoteBreakdownRows } from "@/utils/goldForBusinessesQuote.util";

import styles from "./goldForBusinesses.module.css";

export function GoldQuoteBreakdown({ quote }: { readonly quote: GoldForBusinessesQuote }) {
  return (
    <>
      <dl className={styles.breakdown} aria-label="Price breakdown">
        {buildGoldQuoteBreakdownRows(quote).map((row) => (
          <div key={row.key} className={[styles.breakdownRow, row.emphasis ? styles.breakdownTotal : ""].filter(Boolean).join(" ")}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {quote.profiles.length > 1 ? (
        <dl className={styles.breakdown} aria-label="Price per business">
          {quote.profiles.map((profile) => (
            <div key={profile.profileId} className={styles.breakdownRow}>
              <dt>{profile.displayName}</dt>
              <dd>{formatMoneyForDisplay(profile.price)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {quote.billingNote ? <p className={styles.note}>{quote.billingNote}</p> : null}
    </>
  );
}
