import type { DisputeDetail } from "@/types/commerce.type";
import { formatDateTime } from "@/utils/formatting.util";

import { Card } from "@/components/ui/surfaces";

import styles from "./money.module.css";

export function DisputeCaseFile({ dispute }: { readonly dispute: DisputeDetail }) {
  return (
    <>
      <Card title="Claim and response">
        <div className={styles.stack}>
          <p className={styles.statementLabel}>Buyer · @{dispute.buyer.username}</p>
          <p className={styles.statement}>{dispute.buyerClaim}</p>
        </div>
        <div className={`${styles.stack} ${styles.spacedTop}`}>
          <p className={styles.statementLabel}>Seller · @{dispute.seller.username}</p>
          <p className={styles.statement}>{dispute.sellerResponse ?? "The seller has not responded yet."}</p>
        </div>
      </Card>
      <Card title={`Evidence (${dispute.evidence.length})`}>
        {dispute.evidence.length === 0 ? (
          <p className={styles.muted}>No photos submitted.</p>
        ) : (
          <ul className={styles.gallery}>
            {dispute.evidence.map((evidence) => (
              <li key={evidence.id}>
                <figure>
                  <a href={evidence.imageUrl} target="_blank" rel="noreferrer noopener">
                    <img src={evidence.imageUrl} alt={evidence.caption} referrerPolicy="no-referrer" loading="lazy" />
                  </a>
                  <figcaption>
                    {evidence.caption} · {evidence.submittedBy.toLowerCase()}
                  </figcaption>
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
              <li key={message.id} className={`${styles.message} ${message.authorRole === "SELLER" ? styles.messageFromSeller : ""}`}>
                <p className={styles.messageMeta}>
                  {message.authorName} · {message.authorRole.toLowerCase()} · {formatDateTime(message.sentAt)}
                </p>
                <p>{message.body}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}
