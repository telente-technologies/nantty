import type { ChatEvidenceMessage } from "@/types/chatReport.type";
import { formatDateTime } from "@/utils/formatting.util";

import styles from "./chatEvidence.module.css";

const describeAttachment = (attachment: ChatEvidenceMessage["attachments"][number]) => {
  const name = attachment.fileName ? ` ${attachment.fileName}` : "";
  const size = attachment.sizeBytes ? ` · ${Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB` : "";
  return `${attachment.type}${name}${size}. File content was not submitted.`;
};

export function ChatEvidenceTranscript({ messages }: { readonly messages: readonly ChatEvidenceMessage[] }) {
  return (
    <div className={styles.transcript} role="log" aria-label="Messages submitted by the reporter, read only">
      <p className={styles.transcriptNotice}>Read only. Only the messages the reporter chose to submit are shown. Nothing else in this chat is visible to Nantty.</p>
      {messages.map((message) => (
        <div key={message.messageId} className={`${styles.messageRow} ${message.isReportedUser ? styles.messageRowReported : styles.messageRowOther}`}>
          <span className={styles.messageMeta}>{message.isReportedUser ? `${message.senderName} (reported)` : message.senderName} · {formatDateTime(message.sentAt)}</span>
          <div className={`${styles.bubble} ${message.isReportedUser ? styles.bubbleReported : styles.bubbleOther}`}>
            {message.text}
            {message.attachments.map((attachment) => (
              <div key={`${message.messageId}-${attachment.type}-${attachment.fileName ?? ""}`} className={styles.attachment}>{describeAttachment(attachment)}</div>
            ))}
          </div>
          <span className={styles.submittedLabel}>Submitted by reporter</span>
        </div>
      ))}
    </div>
  );
}
