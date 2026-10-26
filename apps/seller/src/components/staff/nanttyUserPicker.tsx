"use client";

import { useState } from "react";

import { Callout } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/filterControls";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { ZudomartUserCandidate } from "@/types/staff.type";

import styles from "./staff.module.css";

export interface ZudomartUserPickerProps {
  readonly selectedUser: ZudomartUserCandidate | null;
  readonly onSelectUser: (user: ZudomartUserCandidate | null) => void;
  readonly searchApiPath?: string;
}

export function ZudomartUserPicker({ selectedUser, onSelectUser, searchApiPath = "/seller/zudomart-users" }: ZudomartUserPickerProps) {
  const [searchText, setSearchText] = useState("");
  const trimmedSearchText = searchText.trim();
  const candidateSearch = useSellerQuery<{ data: ZudomartUserCandidate[] }>(trimmedSearchText.length >= 2 ? searchApiPath : null, { q: trimmedSearchText });
  const candidates = candidateSearch.data?.data ?? [];

  if (selectedUser) {
    return (
      <Callout tone="info">
        Adding <strong>{selectedUser.name}</strong> (@{selectedUser.username}).{" "}
        <button type="button" className={styles.linkButton} onClick={() => onSelectUser(null)}>Change</button>
      </Callout>
    );
  }

  return (
    <div className={styles.stack}>
      <SearchInput label="Find a Zudomart user" placeholder="Search by @username or name" value={searchText} onValueChange={setSearchText} />
      {candidateSearch.isLoading ? <p className={styles.memberContact}>Searching…</p> : null}
      {trimmedSearchText.length >= 2 && !candidateSearch.isLoading && candidates.length === 0 ? (
        <p className={styles.memberContact}>No Zudomart user matches “{trimmedSearchText}”. Ask them for their exact username in the app.</p>
      ) : null}
      <ul className={styles.candidateList} aria-label="Matching Zudomart users">
        {candidates.map((candidate) => (
          <li key={candidate.userId}>
            <button type="button" className={styles.candidateButton} onClick={() => onSelectUser(candidate)}>
              <strong>{candidate.name}</strong> <span className={styles.memberContact}>@{candidate.username}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
