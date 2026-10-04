"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { ThemeSwitcher, ZudomartWordmark } from "@zudomart/web-kit";

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
  const isSignedInWithoutCreatorAccess = viewer !== null && !viewer.isCreator;

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <Link href="/lives" className={styles.brand} aria-label="Zudomart Studio home">
          <ZudomartWordmark productLabel="Studio" />
        </Link>
        <nav className={styles.navLinks} aria-label="Studio sections">
          <Link href="/lives" className={styles.navLink}>Lives</Link>
          <Link href="/earnings" className={styles.navLink}>Earnings</Link>
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
