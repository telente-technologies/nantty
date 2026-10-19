import { AppIcon } from "@/components/ui/appIcon";
import type { VerificationColor } from "@/types/models.type";

import styles from "./checkmarkBadge.module.css";

const checkmarkLabels: Readonly<Record<VerificationColor, string>> = { blue: "Verified account", gold: "Verified business", black: "Official government account" };

export function CheckmarkBadge({ color, label }: { readonly color: VerificationColor; readonly label?: string }) {
  return (
    <span className={styles.checkmark} data-color={color} role="img" aria-label={label ?? checkmarkLabels[color]}>
      <AppIcon name="check16" size={10} />
    </span>
  );
}
