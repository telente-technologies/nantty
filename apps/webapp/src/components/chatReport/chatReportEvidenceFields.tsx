import type { Message } from "@/types";

import type { ChatReportEvidenceMode } from "./chatReportTarget.type";
import {
  CHAT_REPORT_ENCRYPTION_NOTICE,
  CHAT_REPORT_EVIDENCE_CONSENT_NOTICE,
  LAST_MESSAGES_COUNT_CHOICES,
} from "./chatReportReasons.constant";
import styles from "./chatReport.module.css";

interface ChatReportEvidenceFieldsProps {
  readonly messages: readonly Message[];
  readonly mode: ChatReportEvidenceMode;
  readonly lastMessagesCount: number;
  readonly pickedMessageIds: ReadonlySet<string>;
  readonly selectedEvidenceCount: number;
  readonly onChangeMode: (mode: ChatReportEvidenceMode) => void;
  readonly onChangeLastMessagesCount: (count: number) => void;
  readonly onTogglePickedMessage: (messageId: string) => void;
}

const formatPickerTimestamp = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function ChatReportEvidenceFields({
  messages, mode, lastMessagesCount, pickedMessageIds, selectedEvidenceCount, onChangeMode, onChangeLastMessagesCount, onTogglePickedMessage,
}: ChatReportEvidenceFieldsProps) {
  return (
    <>
      <p className={styles.mutedText}>{CHAT_REPORT_ENCRYPTION_NOTICE}</p>
      <div className={styles.chipRow} role="group" aria-label="Which messages to send">
        <button type="button" className={styles.chip} aria-pressed={mode === "last_messages"} onClick={() => onChangeMode("last_messages")}>Last messages</button>
        <button type="button" className={styles.chip} aria-pressed={mode === "picked_messages"} onClick={() => onChangeMode("picked_messages")}>Pick messages</button>
      </div>
      {mode === "last_messages" ? (
        <div className={styles.chipRow} role="group" aria-label="How many messages">
          {LAST_MESSAGES_COUNT_CHOICES.map((count) => (
            <button key={count} type="button" className={styles.chip} aria-pressed={lastMessagesCount === count} onClick={() => onChangeLastMessagesCount(count)}>
              Last {count}
            </button>
          ))}
        </div>
      ) : (
        <ul className={styles.messagePicker}>
          {[...messages].reverse().map((message) => (
            <li key={message.id}>
              <label className={styles.messageRow}>
                <input type="checkbox" checked={pickedMessageIds.has(message.id)} onChange={() => onTogglePickedMessage(message.id)} />
                <span className={styles.messageText}>
                  <span className={styles.mutedText}>{message.sender?.name ?? "You"} · {formatPickerTimestamp(message.createdAt)}</span>
                  <span>{message.text || "Attachment"}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.consent}>
        <strong>{CHAT_REPORT_EVIDENCE_CONSENT_NOTICE}</strong>
        <span className={styles.mutedText}>
          {selectedEvidenceCount} {selectedEvidenceCount === 1 ? "message" : "messages"} selected. Text, attachment details, times and sender ids are included.
        </span>
      </div>
    </>
  );
}
