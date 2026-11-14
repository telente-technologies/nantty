import Link from "next/link";

import { ArrowsLeftRightIcon } from "@/components/ui/icons";
import { readDeveloperPortalUrl } from "@/config/site.config";

import styles from "./portalShell.module.css";

export function PortalSwitcher({ onNavigate }: { readonly onNavigate?: () => void }) {
  return (
    <nav aria-label="Nantty integration tools" className={styles.productSwitcher}>
      <span className={styles.productSwitcherLabel}><ArrowsLeftRightIcon size={16} /> Switch workspace</span>
      <a href={readDeveloperPortalUrl()} className={styles.productSwitcherLink} onClick={onNavigate}>Developer</a>
      <Link href="/" className={styles.productSwitcherLink} aria-current="page" onClick={onNavigate}>Sandbox</Link>
    </nav>
  );
}
