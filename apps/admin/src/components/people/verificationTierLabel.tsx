import { NanttyIcon } from "@/components/ui/nanttyIcon";
import type { VerificationColor, VerificationTier } from "@/types/platformUser.type";
import { humanizeConstantName } from "@/utils/formatting.util";

import styles from "./verificationTierLabel.module.css";

export function VerificationTierLabel({ color, tier }: { readonly color: VerificationColor; readonly tier: VerificationTier }) {
  return (
    <span className={`${styles.label} ${styles[color.toLowerCase()]}`}>
      <NanttyIcon name="sealCheck20" size={14} />
      {humanizeConstantName(color)} · {humanizeConstantName(tier)}
    </span>
  );
}
