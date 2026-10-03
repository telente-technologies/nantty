import { ZudomartWordmark } from "@zudomart/web-kit";

import { contactEmailDisplayText, buildContactMailtoLinkForBothAddresses } from "@/constants/contact.constant";

import styles from "./landingFooter.module.css";

export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.inner} pageContainer`}>
        <ZudomartWordmark productLabel="Studio" tone="onDark" height={20} />
        <span className={styles.note}>
          Frontend preview running on mock data. Questions? <a href={buildContactMailtoLinkForBothAddresses("Zudomart Studio help")}>{contactEmailDisplayText}</a>
        </span>
      </div>
    </footer>
  );
}
