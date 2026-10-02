"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useSession } from "@/components/providers/sessionProvider";
import { Avatar } from "@/components/ui/media";
import { sendRequestToStudioServer } from "@/services/clientApi.service";
import { useAuthStore } from "@/store/auth.store";

import styles from "./studioShell.module.css";

interface NavItem {
  readonly href: string;
  readonly label: string;
}

const navItems: readonly NavItem[] = [{ href: "/lives", label: "Lives" }];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/lives") return pathname === "/lives" || pathname.startsWith("/lives/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SignOutButton() {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSessionAndSignOut);

  async function signOut() {
    try {
      await sendRequestToStudioServer<void>("/auth/logout", { method: "POST" });
    } catch {
      clearSession();
    }
    clearSession();
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" className={styles.signOut} onClick={signOut}>
      Sign out
    </button>
  );
}

export function StudioShell({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const { viewer } = useSession();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/lives" className={styles.brand}>
          zudomart <span className={styles.brandBadge}>studio</span>
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          <ul className={styles.navList}>
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={isActivePath(pathname, item.href) ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.account}>
            <Avatar name={viewer?.name ?? "Creator"} src={viewer?.avatarUrl ?? null} size="sm" />
            <span className={styles.accountText}>
              <span className={styles.accountName}>{viewer?.name ?? "Creator"}</span>
              <span className={styles.accountHandle}>{viewer?.channelHandle ?? ""}</span>
            </span>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className={styles.frame}>
        <header className={styles.topBar}>
          <Link href="/lives" className={styles.brandMobile}>
            zudomart <span className={styles.brandBadge}>studio</span>
          </Link>
          <SignOutButton />
        </header>
        <main id="main-content" className={styles.main} tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
