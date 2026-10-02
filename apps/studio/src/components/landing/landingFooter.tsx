import { contactEmailDisplayText, buildContactMailtoLinkForBothAddresses } from "@/constants/contact.constant";

import styles from "./landingFooter.module.css";

export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.inner} pageContainer`}>
        <span className={styles.brand}>zudomart studio</span>
        <span className={styles.note}>
          Frontend preview running on mock data. Questions? <a href={buildContactMailtoLinkForBothAddresses("Zudomart Studio help")}>{contactEmailDisplayText}</a>
        </span>
      </div>
    </footer>
  );
}
