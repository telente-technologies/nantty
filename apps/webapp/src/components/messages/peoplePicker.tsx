"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { EmptyState, Spinner } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/media";
import { messagesService } from "@/services/messages.service";
import type { UserSummary } from "@/types";

import styles from "./conversationListPanel.module.css";

interface PeoplePickerProps {
  readonly selected: readonly UserSummary[];
  readonly onToggle: (person: UserSummary) => void;
  readonly excludedUserIds?: readonly string[];
  readonly maximum?: number;
}

export function PeoplePicker({ selected, onToggle, excludedUserIds = [], maximum = 255 }: PeoplePickerProps) {
  const [typed, setTyped] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(typed.trim()), 250);
    return () => clearTimeout(timer);
  }, [typed]);
  const people = useQuery({ queryKey: ["people-to-message", debounced], queryFn: () => messagesService.fetchPeopleToMessage(debounced), placeholderData: keepPreviousData, retry: false });
  const selectedIds = new Set(selected.map((person) => person.id));
  const candidates = (people.data ?? []).filter((person) => !excludedUserIds.includes(person.id));
  return (
    <div>
      <input type="search" className={styles.search} placeholder="Search people" aria-label="Search people" value={typed} onChange={(event) => setTyped(event.target.value)} />
      {selected.length > 0 ? <p className={styles.rowHandle}>{selected.map((person) => person.name).join(", ")}</p> : null}
      {people.isPending ? (
        <Spinner label="Searching" />
      ) : candidates.length === 0 ? (
        <EmptyState title={debounced ? `No one matches “${debounced}”` : "No one to add yet"} />
      ) : (
        <ul className={styles.list}>
          {candidates.map((person) => (
            <li key={person.id}>
              <label className={styles.row}>
                <input type="checkbox" checked={selectedIds.has(person.id)} disabled={!selectedIds.has(person.id) && selected.length >= maximum} onChange={() => onToggle(person)} />
                <Avatar name={person.name} src={person.avatarUrl} size="md" />
                <span className={styles.rowText}>
                  <span className={styles.rowName}>{person.name}</span>
                  <span className={styles.rowHandle}>@{person.username}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const togglePerson = (current: readonly UserSummary[], person: UserSummary): UserSummary[] =>
  current.some((selected) => selected.id === person.id) ? current.filter((selected) => selected.id !== person.id) : [...current, person];
