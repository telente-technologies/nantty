import type { Metadata } from "next";

import { AdsErrorExperienceProvider } from "@/components/errors/errorExperience.provider";
import styles from "@/components/errors/errorPage.module.css";

import { NotFoundScreen } from "@nantty/web-kit";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFoundPage() {
  return (
    <main id="main-content" tabIndex={-1} className={styles.experience}>
      <AdsErrorExperienceProvider>
        <NotFoundScreen title="This page ran out of budget" description="We couldn't find that page. Check the link, or return to your ad accounts to find a campaign." />
      </AdsErrorExperienceProvider>
    </main>
  );
}
