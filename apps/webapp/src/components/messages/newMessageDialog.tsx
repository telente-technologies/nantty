"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/media";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { messagesService } from "@/services/messages.service";

import styles from "./conversationListPanel.module.css";

export function NewMessageDialog({ isOpen, onClose }: { readonly isOpen: boolean; readonly onClose: () => void }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(typed.trim()), 250);
    return () => clearTimeout(timer);
  }, [typed]);
  const people = useQuery({
    queryKey: ["people-to-message", debounced],
    queryFn: () => messagesService.fetchPeopleToMessage(debounced),
    placeholderData: keepPreviousData,
    enabled: isOpen,
    retry: false,
  });
  const start = useMutation({
    mutationFn: (userId: string) => messagesService.startConversationWithUser(userId),
    onSuccess: (conversation) => {
      onClose();
      router.push(`/chats/${encodeURIComponent(conversation.id)}`);
    },
  });

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="New message" layout="sheet" size="medium" intent="message" busy={start.isPending} errorMessage={start.isError ? readErrorMessageForDisplay(start.error) : null}>
      <input type="search" className={styles.search} placeholder="Search people" aria-label="Search people" value={typed} autoFocus onChange={(event) => setTyped(event.target.value)} />
      {people.isPending ? (
        <Spinner label="Searching" />
      ) : people.isError ? (
        <ErrorState description="Couldn't load people." error={people.error} onRetry={() => void people.refetch()} />
      ) : people.data.length === 0 ? (
        <EmptyState title={debounced ? `No one matches “${debounced}”` : "No one to message yet"} description={debounced ? "Check the spelling or try their username." : "Follow people to start a conversation."} />
      ) : (
        <ul className={styles.list}>
          {people.data.map((person) => (
            <li key={person.id}>
              <button type="button" className={styles.row} disabled={start.isPending} onClick={() => start.mutate(person.id)}>
                <Avatar name={person.name} src={person.avatarUrl} size="md" />
                <span className={styles.rowText}>
                  <span className={styles.rowName}>{person.name}</span>
                  <span className={styles.rowHandle}>@{person.username}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
