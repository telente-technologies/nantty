"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AccountSwitcher } from "@/components/shell/accountSwitcher";
import { NanttyWordmark } from "@nantty/web-kit";
import { UserMenu } from "@/components/shell/userMenu";
import { AdAccountProvider, useAdAccount } from "@/components/session/adAccountProvider";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/statusBadge";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { VerificationBanner } from "@/components/verification/verificationPrompt";
import { accountNavigationItems } from "@/config/navigation.config";
import { doesRoleHavePermission } from "@/config/rolePermissions.config";
import type { AdAccountRole } from "@/types/adAccount.type";
import { formatMoneyForDisplay } from "@/utils/money.util";

import styles from "./accountShell.module.css";

const groupLabels = { manage: "Manage", tools: "Tools", account: "Account" } as const;

function AccountRail({ accountId, role }: { readonly accountId: string; readonly role: AdAccountRole }) {
  const pathname = usePathname();
  const visibleItems = accountNavigationItems.filter((item) => doesRoleHavePermission(role, item.permission));
  return (
    <aside className={styles.rail}>
      <Link href="/accounts" className={styles.wordmarkLink} aria-label="All ad accounts">
        <NanttyWordmark productLabel="Ads" tone="onDark" height={20} hideWordOnNarrowScreens withSymbol />
      </Link>
      <nav aria-label="Ad account" className={styles.navigation}>
        {(["manage", "tools", "account"] as const).map((group) => (
          <div key={group} className={styles.navigationGroup}>
            <p className={styles.groupLabel}>{groupLabels[group]}</p>
            <ul>
              {visibleItems
                .filter((item) => item.group === group)
                .map((item) => {
                  const href = `/accounts/${accountId}${item.subPath}`;
                  const isActive = pathname === href || pathname.startsWith(`${href}/`) || (item.subPath === "/campaigns" && /\/(ad-sets|ads)\//.test(pathname));
                  return (
                    <li key={item.subPath}>
                      <Link href={href} className={isActive ? `${styles.navigationLink} ${styles.activeLink}` : styles.navigationLink} aria-current={isActive ? "page" : undefined} title={item.label}>
                        <ZudoIcon name={item.iconName} size={18} />
                        <span className={styles.navigationLabel}>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </nav>
      <Link href="/policy" className={styles.policyLink}>
        <ZudoIcon name="shield24" size={16} />
        <span className={styles.navigationLabel}>Advertising policies</span>
      </Link>
    </aside>
  );
}

function AccountTopBar() {
  const { account, canPerform, buildAccountPagePath } = useAdAccount();
  return (
    <div className={styles.topBarContent}>
      <AccountSwitcher currentAccount={account} />
      <span className={styles.accountBadges}>
        {account.verifiedBusiness ? <StatusBadge tone="accent">Verified business</StatusBadge> : null}
        {account.status !== "active" ? <StatusBadge tone="error">{account.status === "disabled" ? "Disabled" : "Pending review"}</StatusBadge> : null}
      </span>
      <div className={styles.topBarEnd}>
        {canPerform("billing:view") ? (
          <Link href={buildAccountPagePath("/billing")} className={styles.balancePill}>
            <span className={styles.balanceLabel}>Balance</span>
            <span className="numeric">{formatMoneyForDisplay(account.balance)}</span>
          </Link>
        ) : null}
        {canPerform("campaigns:manage") ? (
          <ButtonLink href={buildAccountPagePath("/campaigns/new")} variant="primary" iconName="plus16" className={styles.topBarCreateButton}>
            Create campaign
          </ButtonLink>
        ) : null}
        <UserMenu />
      </div>
    </div>
  );
}

export function AccountShell({ accountId, role, children }: { readonly accountId: string; readonly role: AdAccountRole; readonly children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <AccountRail accountId={accountId} role={role} />
      <div className={styles.column}>
        <AdAccountProvider
          accountId={accountId}
          role={role}
          fallbackFrame={(content) => (
            <>
              <header className={styles.topBar} />
              <main id="main-content" className={styles.main}>
                {content}
              </main>
            </>
          )}
        >
          <header className={styles.topBar}>
            <AccountTopBar />
          </header>
          <main id="main-content" className={styles.main}>
            <VerificationBanner />
            {children}
          </main>
        </AdAccountProvider>
      </div>
    </div>
  );
}
