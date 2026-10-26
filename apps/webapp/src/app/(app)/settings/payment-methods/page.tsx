import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/settings/settings.module.css";
import homeStyles from "@/components/settings/settingsHome.module.css";
import { AppIcon, IconLabel, type AppIconName } from "@/components/ui/appIcon";
import { ChevronRightIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Payment Methods" };

const paymentMethodLinks: readonly { readonly href: string; readonly label: string; readonly description: string; readonly icon: AppIconName }[] = [
  { href: "/subscriptions", label: "Subscriptions", description: "Creators you subscribe to: renewals, cancel and resume", icon: "crown24" },
  { href: "/wallet/payouts", label: "Payout for Sellers", description: "Bank accounts your earnings are paid into", icon: "bank24" },
];

export default function PaymentMethodsSettingsPage() {
  return (
    <div className={styles.page}>
      <div>
        <Link href="/settings"><IconLabel name="arrowLeft24" size={16}>Settings</IconLabel></Link>
        <h1 className={styles.title}>Payment Methods</h1>
      </div>
      <section className={homeStyles.card} aria-labelledby="cards-title">
        <h2 id="cards-title" className={homeStyles.cardTitle}><IconLabel name="creditCard24" size={18}>Cards</IconLabel></h2>
        <p className={homeStyles.linkDescription}>
          You pay securely in our payment partner&apos;s window at checkout. Nantty never stores your card number, and cards aren&apos;t saved in your browser.
        </p>
      </section>
      <nav className={homeStyles.card} aria-label="Payment methods">
        <ul className={homeStyles.linkList}>
          {paymentMethodLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={homeStyles.linkRow}>
                <span className={homeStyles.linkIcon}><AppIcon name={link.icon} size={20} /></span>
                <span className={homeStyles.linkText}>
                  <span className={homeStyles.linkLabel}>{link.label}</span>
                  <span className={homeStyles.linkDescription}>{link.description}</span>
                </span>
                <ChevronRightIcon size={18} />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
