"use client";

import Link from "next/link";

import { ShieldIcon } from "@/components/ui/icons";
import type { LiveAccessLock } from "@/utils/liveAccessLock.util";

import styles from "./liveSafety.module.css";

export function LiveAccessLockOverlay({ lock, hostId, followButton }: { readonly lock: LiveAccessLock; readonly hostId: string; readonly followButton: React.ReactNode }) {
  return (
    <div className={styles.overlay} role="status">
      <span className={styles.overlayIcon}>
        <ShieldIcon size={26} />
      </span>
      <p className={styles.overlayTitle}>{lock.title}</p>
      <p className={styles.overlayText}>{lock.body}</p>
      {lock.action === "follow" ? followButton : null}
      {lock.action === "subscribe" ? <Link href={`/user/${hostId}`}>See subscription options</Link> : null}
    </div>
  );
}
