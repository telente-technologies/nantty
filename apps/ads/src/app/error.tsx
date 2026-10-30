"use client";

import { RouteErrorScreen } from "@nantty/web-kit";

import { AdsErrorExperienceProvider } from "@/components/errors/errorExperience.provider";
import styles from "@/components/errors/errorPage.module.css";

export default function RootRouteError({ error, retry }: { readonly error: Error & { readonly digest?: string }; readonly retry: () => void }) {
  return (
    <main id="main-content" tabIndex={-1} className={styles.experience}>
      <AdsErrorExperienceProvider>
        <RouteErrorScreen error={error} retry={retry} />
      </AdsErrorExperienceProvider>
    </main>
  );
}
