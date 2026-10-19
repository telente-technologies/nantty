"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { UserIdentity } from "@/components/ui/userIdentity";
import { AdminApiRequestError, readErrorMessageForDisplay } from "@/services/adminApiClient.service";
import { fetchPlatformUsers } from "@/services/peopleApi.service";
import type { PlatformUserSummary } from "@/types/platformUser.type";

import styles from "./adCredit.module.css";

export interface PickedAdCreditUser {
  readonly id: string;
  readonly username: string | null;
  readonly currency: string | null;
}

export function AdCreditUserPicker({ pickedUser, onPick }: { readonly pickedUser: PickedAdCreditUser | null; readonly onPick: (user: PickedAdCreditUser | null) => void }) {
  const [searchText, setSearchText] = useState("");
  const [typedUserId, setTypedUserId] = useState("");
  const [matches, setMatches] = useState<readonly PlatformUserSummary[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchForbidden, setIsSearchForbidden] = useState(false);

  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed.length < 2 || isSearchForbidden) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchPlatformUsers({ search: trimmed }, controller.signal)
        .then((page) => { setMatches(page.items.slice(0, 6)); setSearchError(null); })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          if (error instanceof AdminApiRequestError && error.status === 403) setIsSearchForbidden(true);
          else setSearchError(readErrorMessageForDisplay(error));
        });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [searchText, isSearchForbidden]);

  if (pickedUser) {
    return (
      <div className={styles.pickedUser}>
        <span>{pickedUser.username ? `@${pickedUser.username}` : pickedUser.id}</span>
        <span className={styles.muted}>{pickedUser.id}</span>
        <Button size="small" variant="ghost" onClick={() => onPick(null)} aria-label="Choose a different user">Change</Button>
      </div>
    );
  }

  return (
    <div className={styles.picker}>
      {isSearchForbidden ? (
        <p className={styles.muted}>Your role can&apos;t search users. Paste the user ID instead.</p>
      ) : (
        <TextField label="Find the user" placeholder="Username, name or email" value={searchText} onChange={(event) => setSearchText(event.target.value)} hint="Type at least 2 characters." autoComplete="off" />
      )}
      {searchError ? <InlineError message={searchError} /> : null}
      {matches.length > 0 && !isSearchForbidden && searchText.trim().length >= 2 ? (
        <ul className={styles.matchList} aria-label="Matching users">
          {matches.map((user) => (
            <li key={user.id}>
              <button type="button" className={styles.matchButton} onClick={() => onPick({ id: user.id, username: user.username, currency: user.currency })} aria-label={`Choose @${user.username}`}>
                <UserIdentity user={user} size={22} />
                <span className={styles.muted}>{user.currency}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.inlineRow}>
        <TextField label="Or user ID" value={typedUserId} onChange={(event) => setTypedUserId(event.target.value)} autoComplete="off" spellCheck={false} />
        <Button size="small" disabled={typedUserId.trim().length < 3} onClick={() => onPick({ id: typedUserId.trim(), username: null, currency: null })}>Use this ID</Button>
      </div>
    </div>
  );
}
