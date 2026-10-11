import type { Metadata } from "next";

import { AuthSplitLayout } from "@/components/auth/authSplitLayout";
import { LoginForm } from "@/components/auth/loginForm";
import { isMockBackendEnabled } from "@/config/sellerEnvironment.config";
import { readMarketingSiteUrl } from "@/config/siteMetadata.config";

import styles from "@/components/auth/authForms.module.css";

export const metadata: Metadata = { title: "Sign in" };

const demoAccounts = [
  { identifier: "adaeze@ifelifestyle.ng", description: "Owner · Business plan" },
  { identifier: "tunde@ifelifestyle.ng", description: "Manager" },
  { identifier: "blessing@ifelifestyle.ng", description: "Sales staff" },
  { identifier: "ibrahim@ifelifestyle.ng", description: "Inventory staff" },
  { identifier: "ngozi@ifelifestyle.ng", description: "Sales staff" },
  { identifier: "amina.bello@example.com", description: "Accountant" },
  { identifier: "kelechi@kelechikicks.ng", description: "Free plan · verification pending" },
  { identifier: "funmi@funmibakes.ng", description: "Free plan" },
  { identifier: "dayo@gmail.com", description: "Buyer account, not a seller" },
];

export default async function LoginPage({ searchParams }: { readonly searchParams: Promise<{ next?: string; identifier?: string }> }) {
  const { next, identifier } = await searchParams;
  const demoAccountPassword = process.env.NODE_ENV !== "production" && isMockBackendEnabled() ? (await import("@/mocks/seed/demoPeople.mock")).demoAccountPassword : null;
  return (
    <AuthSplitLayout>
      <LoginForm nextPath={next ?? null} initialIdentifier={typeof identifier === "string" ? identifier.slice(0, 254) : ""} getTheAppUrl={readMarketingSiteUrl()} />
      {demoAccountPassword !== null ? (
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
