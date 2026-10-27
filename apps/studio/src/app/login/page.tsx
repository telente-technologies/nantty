import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthSplitLayout } from "@/components/auth/authSplitLayout";
import { LoginForm } from "@/components/auth/loginForm";
import { isMockBackendEnabled } from "@/config/studioEnvironment.config";
import { buildContactMailtoLink, contactEmailDisplayText } from "@/constants/contact.constant";

import styles from "@/components/auth/loginForm.module.css";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default function StudioLoginPage() {
  return (
    <AuthSplitLayout>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      {isMockBackendEnabled() ? (
        <p className={styles.demoHint}>
          Demo mode: sign in as <strong>creator@nantty.com</strong> with any password to open the control room.
        </p>
      ) : null}
      <p className={styles.contact}>
        Need help? <a href={buildContactMailtoLink("Nantty Studio sign-in help")}>{contactEmailDisplayText}</a>
      </p>
    </AuthSplitLayout>
  );
}
