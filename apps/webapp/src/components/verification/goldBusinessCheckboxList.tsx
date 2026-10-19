import { Badge } from "@/components/ui/feedback";
import type { ID } from "@/types";
import type { GoldForBusinessesBusiness } from "@/types/goldForBusinesses.type";
import { GOLD_COVERAGE_LABELS } from "@/utils/goldForBusinessesQuote.util";

import styles from "./goldForBusinesses.module.css";

interface GoldBusinessCheckboxListProps {
  readonly businesses: readonly GoldForBusinessesBusiness[];
  readonly selected: ReadonlySet<ID>;
  readonly maximumProfiles: number;
  readonly canAddMore: boolean;
  readonly onToggle: (profileId: ID) => void;
}

export function GoldBusinessCheckboxList({ businesses, selected, maximumProfiles, canAddMore, onToggle }: GoldBusinessCheckboxListProps) {
  const atMaximum = selected.size >= maximumProfiles;
  return (
    <ul className={styles.list} aria-label="Your businesses">
      {businesses.map((business) => {
        const checked = selected.has(business.profileId);
        const disabled = business.hasOwnGold || (!checked && (atMaximum || !canAddMore));
        const coverageLabel = GOLD_COVERAGE_LABELS[business.coverage];
        return (
          <li key={business.profileId}>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={checked} disabled={disabled} onChange={() => onToggle(business.profileId)} />
              <span className={styles.checkLabel}>
                <span>{business.displayName}</span>
                <span className={styles.note}>{business.hasOwnGold ? "Already has its own Gold plan" : business.profileType === "brand" ? "Brand" : "Business page"}</span>
              </span>
              {coverageLabel ? <Badge tone={business.coverage === "removing" ? "warning" : "neutral"}>{coverageLabel}</Badge> : null}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
