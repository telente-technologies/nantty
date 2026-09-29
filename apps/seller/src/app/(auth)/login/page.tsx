import type { Metadata } from "next";

import { AuthSplitLayout } from "@/components/auth/authSplitLayout";
import { LoginForm } from "@/components/auth/loginForm";
import { isMockBackendEnabled } from "@/config/sellerEnvironment.config";
import { readMarketingSiteUrl } from "@/config/siteMetadata.config";
import { demoAccountPassword } from "@/mocks/seed/demoPeople.mock";

import styles from "@/components/auth/authForms.module.css";

export const metadata: Metadata = { title: "Sign in" };

const demoAccounts = [
  { identifier: "adaeze@ifelifestyle.ng", description: "Owner · Gold Premium store" },
  { identifier: "tunde@ifelifestyle.ng", description: "Manager" },
  { identifier: "blessing@ifelifestyle.ng", description: "Cashier (register only)" },
  { identifier: "ibrahim@ifelifestyle.ng", description: "Inventory" },
  { identifier: "ngozi@ifelifestyle.ng", description: "Support" },
  { identifier: "kelechi@kelechikicks.ng", description: "Verification pending" },
  { identifier: "funmi@funmibakes.ng", description: "Verified, no Gold plan yet" },
  { identifier: "dayo@gmail.com", description: "Buyer account, not a seller" },
];

export default async function LoginPage({ searchParams }: { readonly searchParams: Promise<{ next?: string; identifier?: string }> }) {
  const { next, identifier } = await searchParams;
  return (
    <AuthSplitLayout>
      <LoginForm nextPath={next ?? null} initialIdentifier={typeof identifier === "string" ? identifier.slice(0, 254) : ""} getTheAppUrl={readMarketingSiteUrl()} />
      {isMockBackendEnabled() ? (
        <details className={styles.demoAccounts} style={{ marginTop: 20 }}>
          <summary>Demo accounts (password {demoAccountPassword})</summary>
          <ul>
            {demoAccounts.map((account) => (
              <li key={account.identifier}>
                <code>{account.identifier}</code>
                <span>{account.description}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </AuthSplitLayout>
  );
}
