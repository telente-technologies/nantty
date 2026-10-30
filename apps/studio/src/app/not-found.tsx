import type { Metadata } from "next";

import { StudioErrorExperienceProvider } from "@/components/errors/errorExperience.provider";
import styles from "@/components/errors/errorPage.module.css";

import { NotFoundScreen } from "@nantty/web-kit";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFoundPage() {
  return (
    <main id="main-content" tabIndex={-1} className={styles.experience}>
      <StudioErrorExperienceProvider>
        <NotFoundScreen title="This page wandered off the stage" description="The link may be old or have a typo. Return to the studio to find your content and live streams." />
      </StudioErrorExperienceProvider>
    </main>
  );
}
