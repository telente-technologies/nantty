import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginBrandPanelWithAdComposition } from "@/components/auth/loginBrandPanel";
import { LoginForm } from "@/components/auth/loginForm";
import { isMockBackendEnabled } from "@/config/adsEnvironment.config";
import { buildContactMailtoLink, contactEmailDisplayText } from "@/constants/contact.constant";

import styles from "./loginPage.module.css";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <LoginBrandPanelWithAdComposition />
      <main id="main-content" className={styles.formPanel}>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        {isMockBackendEnabled() ? (
          <p className={styles.demoHint}>
            Demo mode: sign in as <strong>adaeze@ifelifestyle.ng</strong> with password <strong>Nantty2026!</strong>
          </p>
        ) : null}
        <p className={styles.contact}>
          Need help? <a href={buildContactMailtoLink("Nantty Ads sign-in help")}>{contactEmailDisplayText}</a>
        </p>
      </main>
    </div>
  );
}
