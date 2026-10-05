"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ZudoIcon } from "@/components/ui/zudoIcon";
import { roleLabels } from "@/config/rolePermissions.config";
import { accountsApi } from "@/services/accountsApi.service";
import type { AdAccount, AdAccountSummary } from "@/types/adAccount.type";

import styles from "./accountSwitcher.module.css";

export function AccountSwitcher({ currentAccount }: { readonly currentAccount: AdAccount }) {
  const [isOpen, setIsOpen] = useState(false);
  const [accounts, setAccounts] = useState<AdAccountSummary[] | null>(null);
  const [hasLoadFailed, setHasLoadFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (accounts === null && !hasLoadFailed) accountsApi.listMyAdAccounts().then((result) => setAccounts(result.items)).catch(() => setHasLoadFailed(true));
    const closeWhenClickingOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", closeWhenClickingOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeWhenClickingOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, accounts, hasLoadFailed]);

  return (
    <div className={styles.container} ref={containerRef}>
      <button type="button" className={styles.trigger} aria-expanded={isOpen} aria-haspopup="true" onClick={() => setIsOpen((current) => !current)}>
        <span className={styles.accountInitial} aria-hidden>
          {currentAccount.name.slice(0, 1).toUpperCase()}
        </span>
        <span className={styles.triggerText}>
          <span className={styles.accountName}>{currentAccount.name}</span>
          <span className={styles.accountMeta}>
            {currentAccount.kind === "business" ? "Business" : "Personal"} · {currentAccount.currency} · {roleLabels[currentAccount.myRole]}
          </span>
        </span>
        <ZudoIcon name="caretDown24" size={14} />
      </button>
      {isOpen ? (
        <div className={styles.menu}>
          <p className={styles.menuHeading}>Switch ad account</p>
          <ul>
            {(accounts ?? []).map((account) => (
              <li key={account.id}>
                <Link href={`/accounts/${account.id}/overview`} className={account.id === currentAccount.id ? `${styles.menuItem} ${styles.currentItem}` : styles.menuItem} aria-current={account.id === currentAccount.id ? "true" : undefined} onClick={() => setIsOpen(false)}>
                  <span className={styles.accountInitial} aria-hidden>
                    {account.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className={styles.triggerText}>
                    <span className={styles.accountName}>{account.name}</span>
                    <span className={styles.accountMeta}>
                      {account.id} · {account.currency}
                    </span>
                  </span>
                  {account.id === currentAccount.id ? <ZudoIcon name="check16" size={14} /> : null}
                </Link>
              </li>
            ))}
            {accounts === null && !hasLoadFailed ? <li className={styles.menuMessage}>Loading accounts…</li> : null}
            {hasLoadFailed ? (
              <li className={styles.menuMessage} role="alert">
                We couldn&apos;t load your accounts.{" "}
                <button type="button" className={styles.retryLink} onClick={() => setHasLoadFailed(false)}>
                  Try again
                </button>
              </li>
            ) : null}
          </ul>
          <div className={styles.menuFooter}>
            <Link href="/accounts" onClick={() => setIsOpen(false)}>
              All ad accounts
            </Link>
            <Link href="/accounts/new" onClick={() => setIsOpen(false)}>
              New ad account
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
