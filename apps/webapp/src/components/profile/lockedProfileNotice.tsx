import { LockIcon } from "@/components/ui/icons";
import type { LockedProfileCopy } from "@/utils/profileLock.util";

import styles from "./lockedProfileNotice.module.css";

export function LockedProfileNotice({ copy }: { readonly copy: LockedProfileCopy }) {
  return (
    <section className={styles.notice} aria-label={copy.title}>
      <span className={styles.lockCircle} aria-hidden="true"><LockIcon size={28} /></span>
      <h2 className={styles.title}>{copy.title}</h2>
      <p className={styles.message}>{copy.message}</p>
    </section>
  );
}
