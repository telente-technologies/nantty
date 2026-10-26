import { contactEmailDisplayText, contactMailtoHref } from "@/lib/siteConfig.config";

import { FigmaIconTintedWithCurrentColor } from "../ui/figmaIcon";
import styles from "./sellerFeesSection.module.css";

const feeTopicsToPublish = [
  "Opening a store",
  "Commission on each completed sale",
  "Payment processing",
  "Withdrawals to your bank",
  "Promoted posts and live streams",
] as const;

export function SellerFeesPlaceholderSection() {
  return (
    <section id="fees" className={styles.section} aria-labelledby="fees-heading">
      <div className="pageContainer">
        <div className={styles.card}>
          <div className={styles.copyColumn}>
            <p className="eyebrowLabel">Fees</p>
            <h2 id="fees-heading" className={styles.heading}>
              Clear fees, published before launch.
            </h2>
            <p className={styles.description}>
              Final pricing is being set. It will be listed here and in the app, in your local currency, before any store goes live. You will never be charged a fee you did not see first.
            </p>
            <p className={styles.notice} role="note">
              <FigmaIconTintedWithCurrentColor name="warning20" size={20} />
              Placeholder: the Nantty team will replace this section with the confirmed fee schedule.
            </p>
            <p className={styles.contact}>
              Questions about pricing? Email <a href={contactMailtoHref}>{contactEmailDisplayText}</a>.
            </p>
          </div>
          <div>
            <h3 className={styles.listHeading}>What the fee schedule will cover</h3>
            <ul className={styles.topicList}>
              {feeTopicsToPublish.map((feeTopic) => (
                <li key={feeTopic}>
                  <span>{feeTopic}</span>
                  <span className={styles.pendingLabel}>To be announced</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
