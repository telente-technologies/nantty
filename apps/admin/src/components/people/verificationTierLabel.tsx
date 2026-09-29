import { ZudoIcon } from "@/components/ui/zudoIcon";
import type { VerificationColor, VerificationTier } from "@/types/platformUser.type";
import { humanizeConstantName } from "@/utils/formatting.util";

import styles from "./verificationTierLabel.module.css";

export function VerificationTierLabel({ color, tier }: { readonly color: VerificationColor; readonly tier: VerificationTier }) {
  return (
    <span className={`${styles.label} ${styles[color.toLowerCase()]}`}>
      <ZudoIcon name="sealCheck20" size={14} />
      {humanizeConstantName(color)} · {humanizeConstantName(tier)}
    </span>
  );
}
