"use client";

import { MentionText } from "@/components/mentions/mentionText";
import type { ReactNode } from "react";

import type { Message } from "@/types";

import { EncryptedMedia } from "./encryptedMedia";
import { DocumentCard, LocationCard, PollCard, ReactionPicker, ReactionRow, SharedReferenceCard } from "./richMessageParts";
import { DecryptionNotice, EncryptedLinkPreviewCard } from "./secureChatNotices";

export type ChatBubbleStyles = { readonly [className: string]: string };

interface ChatMessageBubbleProps {
  readonly message: Message;
  readonly mine: boolean;
  readonly showSender: boolean;
  readonly styles: ChatBubbleStyles;
  readonly reportButton: ReactNode;
  readonly onReact: (message: Message, emoji: string, reactedByMe: boolean) => void;
  readonly onVote: (message: Message, optionId: string) => void;
  readonly onStopLocation: (message: Message) => void;
  readonly isBusy: boolean;
  readonly senderLabel?: string | null;
  readonly onRetry?: (message: Message) => void;
  readonly onDiscard?: (message: Message) => void;
}

const formatMessageTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function ChatMessageBubble({ message, mine, showSender, styles, reportButton, onReact, onVote, onStopLocation, isBusy, senderLabel, onRetry, onDiscard }: ChatMessageBubbleProps) {
  if (message.kind === "system") return <p className={styles.systemRow}>{message.text}</p>;
  const media = message.media && message.kind !== "document" ? message.media : null;
  const isLocal = Boolean(message.deliveryState);
  const shownSender = senderLabel ?? message.sender?.name ?? null;
  return (
    <div className={[styles.bubbleRow, mine ? styles.bubbleRowMine : ""].filter(Boolean).join(" ")}>
      {mine && !message.decryptionNotice && !isLocal ? <ReactionPicker message={message} onToggle={(emoji, reacted) => onReact(message, emoji, reacted)} /> : null}
      <div className={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs].join(" ")}>
        {showSender && !mine && shownSender ? <span className={styles.senderName}>{shownSender}</span> : null}
        {media ? <EncryptedMedia cacheKey={media.id} type={media.type} url={media.url} pointer={message.attachment} className={styles.bubbleImage} isMine={mine} durationSeconds={media.durationSeconds} /> : null}
        {message.kind === "document" ? <DocumentCard message={message} /> : null}
        {message.poll ? <PollCard message={message} disabled={isBusy || isLocal} onVote={(optionId) => onVote(message, optionId)} /> : null}
        {message.location ? <LocationCard message={message} isMine={mine} onStop={() => onStopLocation(message)} /> : null}
        {message.text ? <p className={styles.bubbleText}><MentionText text={message.text} inverseLinks={mine} /></p> : null}
        {message.decryptionNotice ? <DecryptionNotice text={message.decryptionNotice} /> : null}
        {message.linkPreview ? <EncryptedLinkPreviewCard preview={message.linkPreview} /> : null}
        {message.sharedReference ? <SharedReferenceCard reference={message.sharedReference} /> : null}
        <ReactionRow message={message} onToggle={(emoji, reacted) => onReact(message, emoji, reacted)} />
        {message.deliveryState === "pending" ? <span className={styles.bubbleTime} role="status">{message.pendingLabel ?? "Sending…"}</span> : null}
        {message.deliveryState === "failed" ? (
          <span className={styles.bubbleTime} role="alert">
            Not sent.{" "}
            <button type="button" onClick={() => onRetry?.(message)}>Retry</button>{" "}
            <button type="button" onClick={() => onDiscard?.(message)}>Discard</button>
          </span>
        ) : null}
        {isLocal ? null : <span className={styles.bubbleTime}>{formatMessageTime(message.createdAt)}</span>}
      </div>
      {!mine && !message.decryptionNotice && !isLocal ? <ReactionPicker message={message} onToggle={(emoji, reacted) => onReact(message, emoji, reacted)} /> : null}
      {reportButton}
    </div>
  );
}
