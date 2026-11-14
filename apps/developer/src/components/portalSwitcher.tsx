import Link from "next/link";

import { ArrowsLeftRightIcon } from "@/components/ui/icons";
import { readSandboxPortalUrl } from "@/config/site.config";

import styles from "./portalShell.module.css";

export function PortalSwitcher() {
  return (
    <nav aria-label="Nantty integration tools" className={styles.productSwitcher}>
      <span className={styles.productSwitcherLabel}><ArrowsLeftRightIcon size={16} /> Switch workspace</span>
      <Link href="/dashboard" className={styles.productSwitcherLink} aria-current="page">Developer</Link>
      <a href={readSandboxPortalUrl()} className={styles.productSwitcherLink}>Sandbox</a>
    </nav>
  );
}
