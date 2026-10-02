import Link from "next/link";

import styles from "./landingHeader.module.css";

export function LandingHeader() {
  return (
    <header className={styles.header}>
      <div className={`${styles.inner} pageContainer`}>
        <Link href="/" className={styles.brand} aria-label="Zudomart Studio home">
          zudomart <span className={styles.brandPill}>studio</span>
        </Link>
        <nav className={styles.navigation} aria-label="Main">
          <ul className={styles.navigationList}>
            <li>
              <a href="#features" className={styles.navigationLink}>
                Features
              </a>
            </li>
            <li>
              <a href="#how" className={styles.navigationLink}>
                How it works
              </a>
            </li>
          </ul>
          <Link href="/login" className={styles.action}>
            Log in
          </Link>
        </nav>
      </div>
    </header>
  );
}
