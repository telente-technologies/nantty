import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/settings/settings.module.css";
import homeStyles from "@/components/settings/settingsHome.module.css";
import { AppIcon, IconLabel } from "@/components/ui/appIcon";
import { ExternalLinkIcon } from "@/components/ui/icons";
import { legalLinks } from "@/config/legalLinks.config";

export const metadata: Metadata = { title: "About" };

const aboutLinks = [
  { href: legalLinks.terms, label: "Terms of Service", icon: "scales24" as const },
  { href: legalLinks.privacyPolicy, label: "Privacy Policy", icon: "fileLock24" as const },
];

export default function AboutSettingsPage() {
  return (
    <div className={styles.page}>
      <div>
        <Link href="/settings"><IconLabel name="arrowLeft24" size={16}>Settings</IconLabel></Link>
        <h1 className={styles.title}>About</h1>
      </div>
      <nav className={homeStyles.card} aria-label="About Zudomart">
        <ul className={homeStyles.linkList}>
          {aboutLinks.map((link) => (
            <li key={link.label}>
              <a href={link.href} target="_blank" rel="noopener noreferrer" className={homeStyles.linkRow}>
                <span className={homeStyles.linkIcon}><AppIcon name={link.icon} size={20} /></span>
                <span className={homeStyles.linkText}><span className={homeStyles.linkLabel}>{link.label}</span></span>
                <ExternalLinkIcon size={16} />
              </a>
            </li>
          ))}
          <li>
            <span className={homeStyles.linkRow}>
              <span className={homeStyles.linkIcon}><AppIcon name="hash24" size={20} /></span>
              <span className={homeStyles.linkText}><span className={homeStyles.linkLabel}>Version</span></span>
              <span>{process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0"}</span>
            </span>
          </li>
        </ul>
      </nav>
    </div>
  );
}
