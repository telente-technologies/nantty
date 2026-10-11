import Link from "next/link";

import type { AttentionQueueSummary } from "@/types/metrics.type";
import { formatRelativeTimeFromNow, formatWholeNumber } from "@/utils/formatting.util";

import styles from "./attentionQueueBoard.module.css";

export function AttentionQueueBoard({ queues }: { readonly queues: readonly AttentionQueueSummary[] }) {
  const sortedQueues = [...queues].sort((first, second) => second.breachingSla - first.breachingSla || second.count - first.count);
  if (sortedQueues.length === 0) return <p className={styles.empty}>No queues reported.</p>;
  return (
    <ol className={styles.board}>
      {sortedQueues.map((queue) => (
        <li key={queue.key}>
          <Link href={queue.href} className={`${styles.queue} ${queue.count === 0 ? styles.clear : ""}`}>
            <span className={styles.count}>{formatWholeNumber(queue.count)}</span>
            <span className={styles.label}>{queue.label}</span>
            <span className={styles.meta}>
              {queue.count === 0 ? "Clear" : `Oldest ${formatRelativeTimeFromNow(queue.oldestAt)}`}
              {queue.breachingSla > 0 ? <strong className={styles.sla}>{queue.breachingSla} past SLA</strong> : null}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
