import type { DisputeDetail } from "@/types/commerce.type";
import { formatDateTime, humanizeConstantName } from "@/utils/formatting.util";

import { Card } from "@/components/ui/surfaces";

import styles from "./money.module.css";

export function DisputeCaseFile({ dispute }: { readonly dispute: DisputeDetail }) {
  return (
    <>
      <Card title="Claim and response">
        <div className={styles.stack}>
          <p className={styles.statementLabel}>Buyer · {humanizeConstantName(dispute.reason)}</p>
          <p className={styles.statement}>{dispute.description || "The buyer did not add a description."}</p>
        </div>
        <div className={`${styles.stack} ${styles.spacedTop}`}>
          <p className={styles.statementLabel}>Seller · {dispute.store.name ?? "Store"}</p>
          <p className={styles.statement}>{dispute.sellerResponse ?? "The seller has not responded yet."}</p>
        </div>
      </Card>
      <Card title={`Evidence (${dispute.evidenceUrls.length})`}>
        {dispute.evidenceUrls.length === 0 ? (
          <p className={styles.muted}>No photos submitted.</p>
        ) : (
          <ul className={styles.gallery}>
            {dispute.evidenceUrls.map((url, index) => (
              <li key={url}>
                <figure>
                  <a href={url} target="_blank" rel="noreferrer noopener">
                    <img src={url} alt={`Buyer evidence ${index + 1}`} referrerPolicy="no-referrer" loading="lazy" />
                  </a>
                  <figcaption>Buyer evidence {index + 1}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={`Messages (${dispute.messages.length})`}>
        {dispute.messages.length === 0 ? (
          <p className={styles.muted}>No messages in this dispute yet.</p>
        ) : (
          <ol className={styles.messages}>
            {dispute.messages.map((message) => (
              <li key={message.id} className={`${styles.message} ${message.authorRole === "seller" ? styles.messageFromSeller : ""}`}>
                <p className={styles.messageMeta}>
                  {message.authorName} · {message.authorRole} · {formatDateTime(message.createdAt)}
                </p>
                <p>{message.text}</p>
                {message.attachmentUrls.length > 0 ? (
                  <p className={styles.muted}>
                    {message.attachmentUrls.map((url, index) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer noopener">Attachment {index + 1} </a>
                    ))}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Card>
      <Card title="Status history">
        <ol className={styles.reasons}>
          {dispute.history.map((event, index) => (
            <li key={`${event.status}-${index}`}>{event.label || humanizeConstantName(event.status)} · {formatDateTime(event.occurredAt)}</li>
          ))}
        </ol>
      </Card>
    </>
  );
}
