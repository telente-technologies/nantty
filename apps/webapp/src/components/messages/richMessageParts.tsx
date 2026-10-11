"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { chatSettingsService } from "@/services/chatGroups.service";
import type { Message, SharedContentReference } from "@/types";
import { locationMapUrl } from "@/utils/chatThread.util";

import { useDecryptedMediaUrl } from "./encryptedMedia";
import { SharedContentPreviewCard } from "./secureChatNotices";
import styles from "./richMessage.module.css";

export const quickReactions = ["❤️", "😂", "😮", "😢", "🙏", "👍"] as const;

export function ReactionRow({ message, onToggle }: { readonly message: Message; readonly onToggle: (emoji: string, reactedByMe: boolean) => void }) {
  const reactions = message.reactions ?? [];
  if (reactions.length === 0) return null;
  return (
    <div className={styles.reactions} aria-label="Reactions">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          className={[styles.reaction, reaction.reactedByMe ? styles.reactionMine : ""].join(" ")}
          aria-pressed={reaction.reactedByMe}
          aria-label={`${reaction.emoji} ${reaction.count}${reaction.reactedByMe ? ", you reacted" : ""}`}
          onClick={() => onToggle(reaction.emoji, reaction.reactedByMe)}
        >
          {reaction.emoji} {reaction.count}
        </button>
      ))}
    </div>
  );
}

export function ReactionPicker({ message, onToggle }: { readonly message: Message; readonly onToggle: (emoji: string, reactedByMe: boolean) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const mine = new Set((message.reactions ?? []).filter((reaction) => reaction.reactedByMe).map((reaction) => reaction.emoji));
  return (
    <span className={styles.pickerHost}>
      <button type="button" className={styles.pickerTrigger} aria-label="React to message" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
        ☺
      </button>
      {isOpen ? (
        <span className={styles.picker} role="group" aria-label="Pick a reaction">
          {quickReactions.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={[styles.pickerEmoji, mine.has(emoji) ? styles.reactionMine : ""].join(" ")}
              aria-label={mine.has(emoji) ? `Remove ${emoji}` : `React ${emoji}`}
              onClick={() => {
                setIsOpen(false);
                onToggle(emoji, mine.has(emoji));
              }}
            >
              {emoji}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}

export function PollCard({ message, onVote, disabled }: { readonly message: Message; readonly onVote: (optionId: string) => void; readonly disabled: boolean }) {
  const poll = message.poll;
  if (!poll) return null;
  const tally = message.pollTally ?? poll.options.map((option) => ({ ...option, voteCount: 0, votedByMe: false }));
  const total = tally.reduce((sum, option) => sum + option.voteCount, 0);
  return (
    <fieldset className={styles.poll}>
      <legend className={styles.pollQuestion}>{poll.question}</legend>
      <span className={styles.pollHint}>{poll.allowMultipleAnswers ? "Select one or more" : "Select one"}</span>
      {tally.map((option) => {
        const share = total === 0 ? 0 : Math.round((option.voteCount / total) * 100);
        return (
          <button key={option.id} type="button" className={[styles.pollOption, option.votedByMe ? styles.pollOptionMine : ""].join(" ")} aria-pressed={option.votedByMe} disabled={disabled} onClick={() => onVote(option.id)}>
            <span className={styles.pollBar} style={{ width: `${share}%` }} aria-hidden="true" />
            <span className={styles.pollLabel}>{option.text}</span>
            <span className={styles.pollCount}>{option.voteCount}</span>
          </button>
        );
      })}
      <span className={styles.pollHint}>{total === 1 ? "1 vote" : `${total} votes`} · end-to-end encrypted</span>
    </fieldset>
  );
}

export function LocationCard({ message, isMine, onStop }: { readonly message: Message; readonly isMine: boolean; readonly onStop: () => void }) {
  const live = message.liveLocation;
  const location = live ?? message.location;
  if (!location) return null;
  const isLive = message.kind === "liveLocation";
  return (
    <div className={styles.location}>
      <a className={styles.locationLink} href={locationMapUrl(location.latitude, location.longitude)} target="_blank" rel="noopener noreferrer nofollow">
        <span className={styles.locationTitle}>{isLive ? (live?.stopped ? "Live location ended" : "Live location") : "Location"}</span>
        <span>{location.label ?? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`}</span>
        <span className={styles.pollHint}>Open in map</span>
      </a>
      {isLive && live && !live.stopped && live.liveUntil ? <span className={styles.pollHint}>Sharing until {new Date(live.liveUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> : null}
      {isLive && isMine && live && !live.stopped ? (
        <button type="button" className={styles.inlineAction} onClick={onStop}>
          Stop sharing
        </button>
      ) : null}
    </div>
  );
}

export function SharedReferenceCard({ reference }: { readonly reference: SharedContentReference }) {
  const card = useQuery({ queryKey: ["chat-content", reference.kind, reference.id], queryFn: () => chatSettingsService.resolveSharedContent(reference), staleTime: 60_000, retry: false });
  if (card.isPending) return <span className={styles.pollHint}>Loading shared {reference.kind}…</span>;
  if (card.isError || !card.data) return <SharedContentPreviewCard card={{ reference, availability: "unavailable", title: "", subtitle: null, imageUrl: null }} />;
  return <SharedContentPreviewCard card={card.data} />;
}

export function DocumentCard({ message }: { readonly message: Message }) {
  const pointer = message.attachment;
  const resolved = useDecryptedMediaUrl(message.media?.id ?? message.id, message.document?.url ?? message.media?.url ?? null, pointer);
  if (!pointer) return null;
  const name = pointer.fileName ?? "Document";
  const size = pointer.sizeBytes >= 1_048_576 ? `${(pointer.sizeBytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(pointer.sizeBytes / 1024))} KB`;
  const body = (
    <>
      <span className={styles.locationTitle}>📄 {name}</span>
      <span className={styles.pollHint}>{[size, pointer.pageCount ? `${pointer.pageCount} pages` : null].filter(Boolean).join(" · ")}</span>
    </>
  );
  if (resolved.failed) return <span className={styles.document}>{body}<span className={styles.pollHint}>This file couldn&apos;t be decrypted.</span></span>;
  return resolved.url && !resolved.url.startsWith("data:") ? (
    <a className={styles.document} href={resolved.url} download={name}>
      {body}
    </a>
  ) : (
    <span className={styles.document}>{body}</span>
  );
}
