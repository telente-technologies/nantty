import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/loginForm";
import { DashboardWordmark } from "@/components/layout/sidebarNavigation";
import { isMockBackendEnabled } from "@/config/sellerEnvironment.config";
import { demoAccountPassword } from "@/mocks/seed/demoPeople.mock";

import styles from "./login.module.css";

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

export default async function LoginPage({ searchParams }: { readonly searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const showDemoAccounts = isMockBackendEnabled();
  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.brandPanel} aria-hidden="true">
        <div className={styles.brandInner}>
          <DashboardWordmark />
          <p className={styles.brandLine}>Your till, your stock and your online orders — one ledger.</p>
          <div className={styles.tape}>
            <p>RECEIPT · LEKKI</p>
            <p>Adire Oxford Shirt ×1</p>
            <p>Glow Face Serum ×2</p>
            <p>Zobo Drink 50cl ×3</p>
            <p className={styles.tapeTotal}>SYNCED TO ZUDOMART</p>
          </div>
        </div>
      </section>
      <section className={styles.formPanel}>
        <div className={styles.formInner}>
          <h1 className={styles.title}>Sign in to your store</h1>
          <p className={styles.subtitle}>Use the same email or phone and password as your Zudomart app.</p>
          <LoginForm nextPath={next ?? null} />
          {showDemoAccounts ? (
            <details className={styles.demoAccounts}>
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
        </div>
      </section>
    </main>
  );
}
