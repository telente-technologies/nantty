"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ThemeSwitcher, NanttyLogoMark } from "@nantty/web-kit";

import { useAdminPermissions, useAdminSession } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { KeyboardKey } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { readErrorMessageForDisplay, sendRequestToAdminConsoleServer } from "@/services/adminApiClient.service";

import { globalSearchInputId } from "./keyboardShortcuts";
import styles from "./consoleTopBar.module.css";

export function ConsoleTopBar({ onOpenNavigation }: { readonly onOpenNavigation: () => void }) {
  const router = useRouter();
  const { admin, isMockBackend, sessionStartedAtEpochSeconds, absoluteTimeoutSeconds } = useAdminSession();
  const { can } = useAdminPermissions();
  const [searchText, setSearchText] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { showToast } = useToast();
  const sessionEndsAt = new Date((sessionStartedAtEpochSeconds + absoluteTimeoutSeconds) * 1000);

  function searchUsers(event: FormEvent) {
    event.preventDefault();
    const trimmed = searchText.trim();
    if (trimmed) router.push(`/users?search=${encodeURIComponent(trimmed)}`);
  }

  async function signOut() {
    setIsSigningOut(true);
    try {
      const result = await sendRequestToAdminConsoleServer<{ redirectTo: string }>("/bff/auth/logout", { method: "POST", promptForStepUp: false });
      window.location.assign(result.redirectTo);
    } catch (error) {
      showToast(`Sign-out failed. ${readErrorMessageForDisplay(error)}`, "error");
      setIsSigningOut(false);
    }
  }

  return (
    <header className={styles.topBar}>
      <button type="button" className={styles.menuButton} onClick={onOpenNavigation} aria-label="Open navigation">
        <ZudoIcon name="squaresFour24" size={18} />
      </button>
      <Link href="/" className={styles.compactBrand} aria-label="Nantty Admin start page">
        <NanttyLogoMark size={28} />
      </Link>
      {can("users:read") ? (
        <form className={styles.search} role="search" onSubmit={searchUsers}>
          <ZudoIcon name="magnifyingGlass16" size={14} className={styles.searchIcon} />
          <label htmlFor={globalSearchInputId} className="visuallyHidden">
            Search users by username, name or ID
          </label>
          <input id={globalSearchInputId} className={styles.searchInput} placeholder="Find a user by @username, name or ID" value={searchText} onChange={(event) => setSearchText(event.target.value)} autoComplete="off" />
          <KeyboardKey>/</KeyboardKey>
        </form>
      ) : (
        <span className={styles.spacer} />
      )}
      <div className={styles.right}>
        {isMockBackend ? <span className={styles.mockNotice} title="Data comes from the built-in demo backend, not the Nantty API.">Demo data</span> : null}
        <span className={styles.session} title={`Signed in as ${admin.email}. Session ends by ${sessionEndsAt.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })} at the latest.`}>
          {admin.email}
        </span>
        <ThemeSwitcher iconOnly label="Colour theme" />
        <Button size="small" variant="ghost" onClick={signOut} isBusy={isSigningOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
