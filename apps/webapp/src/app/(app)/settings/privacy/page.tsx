import type { Metadata } from "next";
import Link from "next/link";

import { BirthdayBalloonsSection } from "@/components/settings/birthdayBalloonsSection";
import { ConsentChoicesSection } from "@/components/settings/consentChoicesSection";
import { ContentPreferencesSection } from "@/components/settings/contentPreferencesSection";
import { DataExportSection } from "@/components/settings/dataExportSection";
import { DeleteAccountSection } from "@/components/settings/deleteAccountSection";
import { DownloadPrivacySection } from "@/components/settings/downloadPrivacySection";
import { MentionPrivacySection } from "@/components/settings/mentionPrivacySection";
import { ProfileVisibilitySection } from "@/components/settings/profileVisibilitySection";
import styles from "@/components/settings/settings.module.css";
import { legalLinks } from "@/config/legalLinks.config";
import { IconLabel } from "@/components/ui/appIcon";

export const metadata: Metadata = { title: "Privacy & Data" };

export default function PrivacyAndDataPage() {
  return (
    <div className={styles.page}>
      <div>
        <Link href="/settings"><IconLabel name="arrowLeft24" size={16}>Settings</IconLabel></Link>
        <h1 className={styles.title}>Privacy &amp; Data</h1>
      </div>
      <div id="privacy-controls" className={styles.page}>
        <ProfileVisibilitySection />
        <MentionPrivacySection />
        <DownloadPrivacySection />
        <BirthdayBalloonsSection />
        <ContentPreferencesSection />
      </div>
      <div id="your-data" className={styles.page}>
        <ConsentChoicesSection />
        <DataExportSection />
      </div>
      <section aria-labelledby="policies-heading" className={styles.block}>
        <h2 id="policies-heading" className={styles.blockHeading}>Policies</h2>
        <ul className={styles.linkList}>
          <li><a href={legalLinks.privacyPolicy} target="_blank" rel="noopener noreferrer">Privacy Policy</a></li>
          <li><a href={legalLinks.cookiePolicy} target="_blank" rel="noopener noreferrer">Cookie Policy</a></li>
          <li><a href={legalLinks.terms} target="_blank" rel="noopener noreferrer">Terms of Service</a></li>
          <li><a href={legalLinks.dataRights} target="_blank" rel="noopener noreferrer">Data rights requests</a></li>
        </ul>
      </section>
      <DeleteAccountSection />
    </div>
  );
}
