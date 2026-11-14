import { readDeveloperPortalUrl } from "@/config/site.config";

import styles from "./portalShell.module.css";

export function PortalSwitcher({ onNavigate }: { readonly onNavigate?: () => void }) {
  return (
    <section className={styles.workspaceSwitcher} aria-label="Workspace">
      <h2 className={styles.workspaceSwitcherLabel}>Switch workspace</h2>
      <nav aria-label="Nantty workspaces">
        <ul className={styles.workspaceSwitcherList}>
          <li><a className={styles.workspaceLink} href={readDeveloperPortalUrl()} target="_blank" rel="noopener noreferrer" onClick={onNavigate}>Developer <span aria-hidden="true">↗</span><span className={styles.srOnly}> (opens in a new tab)</span></a></li>
          <li><span className={styles.workspaceCurrent} aria-current="page">Sandbox</span></li>
        </ul>
      </nav>
    </section>
  );
}
