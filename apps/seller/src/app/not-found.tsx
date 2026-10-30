import type { Metadata } from "next";

import { SellerErrorExperienceProvider } from "@/components/errors/errorExperience.provider";
import styles from "@/components/errors/errorPage.module.css";

import { NotFoundScreen } from "@nantty/web-kit";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFoundPage() {
  return (
    <main id="main-content" tabIndex={-1} className={styles.experience}>
      <SellerErrorExperienceProvider>
        <NotFoundScreen title="Not in stock" description="We couldn't find that page. The link may be old or have a typo. Return to your dashboard to find your store and orders." />
      </SellerErrorExperienceProvider>
    </main>
  );
}
