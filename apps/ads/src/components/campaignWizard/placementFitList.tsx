import type { WizardAdDraft } from "@/components/campaignWizard/campaignWizardState.store";
import { buildCreativeShapeFromAdDraft } from "@/components/campaignWizard/campaignWizardSubmission.util";
import { NanttyIcon } from "@/components/ui/nanttyIcon";
import { placementLabels } from "@/constants/campaignOptions.constant";
import type { AdAccount } from "@/types/adAccount.type";
import type { AdPlacement } from "@/types/campaign.type";
import { checkCreativeFitForEveryPlacement, type PlacementFitStatus } from "@/utils/adPlacementRules.util";

import styles from "./placementFitList.module.css";

const statusIcons = { ready: "check16", adjusted: "warning20", blocked: "cancel20" } as const;
const statusLabels: Record<PlacementFitStatus, string> = { ready: "Fits", adjusted: "Adjusted", blocked: "Won't run" };

interface PlacementFitListProps {
  readonly ad: WizardAdDraft;
  readonly account: AdAccount;
  readonly placements: readonly AdPlacement[];
  readonly error?: string;
}

export function PlacementFitList({ ad, placements, error }: PlacementFitListProps) {
  const hasCreative = ad.sourceType === "upload" ? ad.uploadedMedia.length > 0 : Boolean(ad.selectedSource);
  if (!hasCreative) return null;
  const fits = checkCreativeFitForEveryPlacement(buildCreativeShapeFromAdDraft(ad), placements);
  return (
    <section className={styles.panel} aria-labelledby={`fit-${ad.key}`}>
      <h4 id={`fit-${ad.key}`} className={styles.heading}>
        Where this ad can run
      </h4>
      <ul className={styles.list}>
        {fits.map((fit) => (
          <li key={fit.placement} className={`${styles.row} ${styles[fit.status]}`}>
            <NanttyIcon name={statusIcons[fit.status]} size={14} className={styles.icon} />
            <span className={styles.placementName}>{placementLabels[fit.placement]}</span>
            <span className={styles.statusLabel}>{statusLabels[fit.status]}</span>
            <span className={styles.message}>{fit.message}</span>
          </li>
        ))}
      </ul>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
