"use client";

import { EncryptedAttachment } from "@/components/messages/encryptedAttachment";
import { SharedItemCard } from "@/components/messages/sharedItemCard";
import { Button } from "@/components/ui/button";
import { IconLabel } from "@/components/ui/nanttyIcon";
import type { DecryptedConversationMessage } from "@/types/conversation.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";
import { describeMessageKind } from "@/utils/storeChat.util";

import styles from "./messages.module.css";

function MessageBody({ message }: { readonly message: DecryptedConversationMessage }) {
  if (message.decryptionNotice) return <em>{message.decryptionNotice}</em>;
  const attachmentUrl = message.media?.url ?? message.document?.url ?? null;
  return (
    <>
      {message.sharedReference ? <SharedItemCard reference={message.sharedReference} /> : null}
      {message.attachment ? <EncryptedAttachment url={attachmentUrl} pointer={message.attachment} kind={message.kind} /> : null}
      {message.location ? (
        <a href={`https://www.openstreetmap.org/?mlat=${message.location.latitude}&mlon=${message.location.longitude}#map=16/${message.location.latitude}/${message.location.longitude}`} target="_blank" rel="noreferrer">
          {message.kind === "liveLocation" ? "Live location" : "Location"}: {message.location.label ?? `${message.location.latitude.toFixed(5)}, ${message.location.longitude.toFixed(5)}`}
        </a>
      ) : null}
      {message.poll ? <span>Poll: {message.poll.question}</span> : null}
      {message.text ? <span>{message.text}</span> : null}
      {!message.text && !message.attachment && !message.location && !message.poll && !message.sharedReference ? <span>{message.pending && message.pendingLabel ? message.pendingLabel : describeMessageKind(message.kind)}</span> : null}
    </>
  );
}

interface MessageBubbleProps {
  readonly message: DecryptedConversationMessage;
  readonly reactions: readonly { readonly emoji: string; readonly count: number }[];
  readonly isSeen: boolean;
  readonly onRetry: (key: string) => void;
  readonly onDiscard: (key: string) => void;
}

export function MessageBubble({ message, reactions, isSeen, onRetry, onDiscard }: MessageBubbleProps) {
  const fromSeller = message.from === "seller";
  const key = message.clientMessageId ?? "";
  return (
    <div className={`${styles.bubble} ${fromSeller ? styles.bubbleFromSeller : ""} ${message.failed ? styles.bubbleFailed : ""}`} aria-busy={message.pending ? "true" : undefined}>
      <MessageBody message={message} />
      {reactions.length > 0 ? <span className={styles.bubbleTime}>{reactions.map((reaction) => `${reaction.emoji} ${reaction.count}`).join("  ")}</span> : null}
      <span className={styles.bubbleTime}>
        {fromSeller ? `${message.senderName} · ` : ""}
        {message.failed ? "Not sent" : message.pending ? (message.pendingLabel ?? "Sending…") : formatDateTimeForDisplay(message.createdAt)}
        {isSeen ? <> · <IconLabel name="checks16" size={12}>Seen</IconLabel></> : null}
      </span>
      {message.failed ? (
        <span role="alert" className={styles.bubbleActions}>
          <span>{message.pendingLabel}</span>
          <Button size="small" iconName="refresh20" onClick={() => onRetry(key)}>Retry</Button>
          <Button size="small" variant="ghost" onClick={() => onDiscard(key)}>Discard</Button>
        </span>
      ) : null}
    </div>
  );
}
