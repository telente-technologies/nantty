"use client";

import { Dialog } from "@/components/ui/dialog";
import { useSession } from "@/components/providers/sessionProvider";

import styles from "./celebrations.module.css";
import { FloatingBalloons } from "./floatingBalloons";
import { useSurfaceCelebration } from "./useSurfaceCelebration.hook";

export function CelebrationHost() {
  const { viewer } = useSession();
  const { celebration, dismiss } = useSurfaceCelebration("app", viewer !== null);
  if (!celebration) return null;
  return (
    <Dialog
      isOpen
      onClose={dismiss}
      title={celebration.title}
      description={celebration.message.slice(celebration.title.length).trim()}
      tone="brand"
      role="alertdialog"
      actions={[{ label: "Thank you", onClick: dismiss, variant: "primary", isInitialFocus: true }]}
    >
      <div className={styles.dialogBalloons}>
        <FloatingBalloons count={6} />
      </div>
      <span className="visuallyHidden" role="status" aria-live="polite">{celebration.message}</span>
      {celebration.stats.length > 0 ? (
        <dl className={styles.stats}>
          {celebration.stats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <dd>{stat.value}</dd>
              <dt>{stat.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}
    </Dialog>
  );
}
