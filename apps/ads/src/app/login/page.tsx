import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/loginForm";
import { AdsWordmark } from "@/components/shell/adsWordmark";
import { isMockBackendEnabled } from "@/config/adsEnvironment.config";

import styles from "./loginPage.module.css";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <section className={styles.brandPanel} aria-label="About Zudomart Ads Manager">
        <AdsWordmark />
        <div className={styles.pitch}>
          <p className={styles.pitchHeadline}>Put your store in front of buyers across Nigeria and beyond.</p>
          <ul className={styles.pitchList}>
            <li>Promote posts, clips, products and your store in feed, Clips, Mart, search, stories and live.</li>
            <li>Sales from your Zudomart store are attributed automatically.</li>
            <li>Pay from a prepaid balance or card, in your own currency.</li>
          </ul>
        </div>
        <p className={styles.small}>Boosting a single post? You can do that right from the app.</p>
      </section>
      <main id="main-content" className={styles.formPanel}>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        {isMockBackendEnabled() ? (
          <p className={styles.demoHint}>
            Demo mode: sign in as <strong>adaeze@ifelifestyle.ng</strong> with password <strong>Zudomart2026!</strong>
          </p>
        ) : null}
      </main>
    </div>
  );
}
