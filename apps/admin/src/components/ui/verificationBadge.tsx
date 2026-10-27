import type { UserVerificationSummary } from "@/types/platformUser.type";
import { humanizeConstantName } from "@/utils/formatting.util";

import styles from "./verificationBadge.module.css";
import { NanttyIcon } from "./nanttyIcon";

export function VerificationBadge({ verification, isLabelShown = false }: { readonly verification: UserVerificationSummary; readonly isLabelShown?: boolean }) {
  const label = `${humanizeConstantName(verification.color)} ${humanizeConstantName(verification.tier)} · ${humanizeConstantName(verification.status)}${verification.badgeVisible ? "" : " (no public badge)"}`;
  return (
    <span className={`${styles.badge} ${styles[verification.color.toLowerCase()]} ${verification.badgeVisible ? "" : styles.hidden}`} title={label}>
      <NanttyIcon name="sealCheck20" size={13} label={isLabelShown ? undefined : label} />
      {isLabelShown ? <span>{label}</span> : null}
    </span>
  );
}
