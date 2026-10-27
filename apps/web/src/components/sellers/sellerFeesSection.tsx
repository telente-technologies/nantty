import { contactEmailDisplayText, contactMailtoHref } from "@/lib/siteConfig.config";

import { FigmaIconTintedWithCurrentColor } from "../ui/figmaIcon";
import styles from "./sellerFeesSection.module.css";

const feeSchedule = [
  { label: "Opening a store", value: "One-time $1 fee" },
  { label: "Commission on each completed sale", value: "0%" },
  { label: "Payment processing", value: "Flutterwave's applicable charge" },
  { label: "Withdrawals to your bank", value: "Flutterwave's applicable charge" },
  { label: "Promoted posts", value: "Budget and price shown before you publish" },
  { label: "Livestreams and Spaces", value: "Creator Program acceptance required" },
] as const;

export function SellerFeesSection() {
  return (
    <section id="fees" className={styles.section} aria-labelledby="fees-heading">
      <div className="pageContainer">
        <div className={styles.card}>
          <div className={styles.copyColumn}>
            <p className="eyebrowLabel">Fees</p>
            <h2 id="fees-heading" className={styles.heading}>
              Clear fees. No sales commission.
            </h2>
            <p className={styles.description}>
              Opening a store costs a one-time $1. Nantty takes no commission on completed sales. Flutterwave&apos;s applicable payment-processing and withdrawal charges are shown before you confirm.
            </p>
            <p className={styles.notice} role="note">
              <FigmaIconTintedWithCurrentColor name="warning20" size={20} />
              Every charge is shown before you confirm it. Creator tools such as livestreams and Spaces are available only after acceptance into the Creator Program.
            </p>
            <p className={styles.contact}>
              Questions about pricing? Email <a href={contactMailtoHref}>{contactEmailDisplayText}</a>.
            </p>
          </div>
          <div>
            <h3 className={styles.listHeading}>What the fee schedule will cover</h3>
            <ul className={styles.topicList}>
              {feeSchedule.map((fee) => (
                <li key={fee.label}>
                  <span>{fee.label}</span>
                  <span className={styles.feeValue}>{fee.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
