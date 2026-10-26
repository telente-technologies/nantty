import { ExternalLinkIcon } from "@/components/ui/icons";
import type { BoostStatus } from "@/types/boost.type";
import type { Money } from "@/types/money.type";
import { adStatusAppearance, spendFraction, type AdStatusTone } from "@/utils/adsHub.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "./adsHub.module.css";

const TONE_CLASS: Record<AdStatusTone, string> = { neutral: styles.statusNeutral!, caution: styles.statusCaution!, success: styles.statusSuccess!, error: styles.statusError! };

export function AdStatusChip({ status }: { readonly status: BoostStatus }) {
  const appearance = adStatusAppearance(status);
  return <span className={`${styles.status} ${TONE_CLASS[appearance.tone]}`}>{appearance.label}</span>;
}

export function AdSpendMeter({ spent, budget }: { readonly spent: Money; readonly budget: Money }) {
  const fraction = spendFraction(spent, budget);
  const label = `Spent ${formatMoneyForDisplay(spent)} of ${formatMoneyForDisplay(budget)}`;
  return (
    <div className={styles.section}>
      <span className={styles.rowMeta}>{label}</span>
      <div className={styles.meter} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}>
        <div className={styles.meterFill} style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}

const adsManagerUrl = process.env.NEXT_PUBLIC_ADS_MANAGER_URL || "https://ads.nantty.com";

export function AdsManagerOptionalLink() {
  return (
    <a className={styles.quietLink} href={adsManagerUrl} target="_blank" rel="noopener noreferrer">
      Need more? Open Ads Manager <ExternalLinkIcon size={14} />
    </a>
  );
}

export const formatAdDate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};
