import type { SupportMessage } from "@/types/support.type";
import { formatDateTime, formatRelativeTimeFromNow } from "@/utils/formatting.util";

import styles from "./ticketConversation.module.css";

const authorLabels: Record<SupportMessage["authorKind"], string> = { CUSTOMER: "Customer", AGENT: "Agent reply", INTERNAL_NOTE: "Internal note · not visible to customer", SYSTEM: "System" };

export function TicketConversation({ messages }: { readonly messages: readonly SupportMessage[] }) {
  return (
    <ol className={styles.thread} aria-label="Conversation">
      {messages.map((message) => (
        <li key={message.id} className={`${styles.message} ${styles[message.authorKind === "CUSTOMER" ? "customer" : message.authorKind === "AGENT" ? "agent" : "note"]}`}>
          <p className={styles.meta}>
            <strong>{message.authorName}</strong> <span className={styles.kind}>{authorLabels[message.authorKind]}</span> ·{" "}
            <time dateTime={message.createdAt} title={formatDateTime(message.createdAt)}>
              {formatRelativeTimeFromNow(message.createdAt)}
            </time>
          </p>
          <p className={styles.body}>{message.body}</p>
        </li>
      ))}
    </ol>
  );
}
