"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { OfflineBanner, ThemeSwitcher, ZudomartWordmark } from "@zudomart/web-kit";

import { CreatorProgramGate } from "@/components/shell/creatorProgramGate";
import { useSession } from "@/components/providers/sessionProvider";
import { Avatar } from "@/components/ui/media";
import { sendRequestToStudioServer } from "@/services/clientApi.service";
import { useAuthStore } from "@/store/auth.store";

import styles from "./studioShell.module.css";

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
  const { viewer } = useSession();
  const pathname = usePathname();
  const isSignedInWithoutCreatorAccess = viewer !== null && !viewer.isCreator;
  const sectionLinks = [
    { href: "/lives", label: "Lives" },
    { href: "/earnings", label: "Earnings" },
  ];

  return (
    <div className={styles.shell}>
      <OfflineBanner />
      <header className={styles.topBar}>
        <Link href="/lives" className={styles.brand} aria-label="Zudomart Studio home">
          <ZudomartWordmark productLabel="Studio" height={20} withSymbol collapseToMarkOnSmallScreens />
        </Link>
        <nav className={styles.navLinks} aria-label="Studio sections">
          {sectionLinks.map((link) => {
            const isCurrent = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link key={link.href} href={link.href} className={styles.navLink} aria-current={isCurrent ? "page" : undefined}>
                {link.label}
              </Link>
            );
          })}
          <a href={`${process.env.NEXT_PUBLIC_WEBAPP_URL ?? "https://app.zudomart.com"}/help/live`} className={styles.navLink} target="_blank" rel="noopener noreferrer">Help</a>
        </nav>
        <div className={styles.account}>
          <ThemeSwitcher iconOnly className={styles.themeSwitcher} />
          <span className={styles.avatar}>
            <Avatar name={viewer?.name ?? "Creator"} src={viewer?.avatarUrl ?? null} size="sm" />
          </span>
          <span className={styles.accountText}>
            <span className={styles.accountName}>{viewer?.name ?? "Creator"}</span>
            <span className={styles.accountHandle}>{viewer?.channelHandle ?? ""}</span>
          </span>
          <SignOutButton />
        </div>
      </header>
      <main id="main-content" className={styles.main} tabIndex={-1}>
        {isSignedInWithoutCreatorAccess ? <CreatorProgramGate /> : children}
      </main>
    </div>
  );
}
