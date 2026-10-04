"use client";

import Link from "next/link";
import { useState } from "react";

import { useSession } from "@/components/providers/sessionProvider";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { supportService } from "@/services/support.service";

import styles from "./help.module.css";

export function HelpVoteButtons({ topicId, topicPath, helpfulCount }: { readonly topicId: string; readonly topicPath: string; readonly helpfulCount: number }) {
  const { viewer } = useSession();
  const [vote, setVote] = useState<boolean | null>(null);
  const [count, setCount] = useState(helpfulCount);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function send(helpful: boolean) {
    setIsSending(true);
    setErrorMessage(null);
    try {
      const result = await supportService.voteOnHelpTopic(topicId, helpful);
      setVote(result.viewerVote);
      setCount(result.helpfulCount);
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="helpful-heading">
      <h2 id="helpful-heading" className={styles.cardTitle}>Was this helpful?</h2>
      {viewer ? (
        <div className={styles.row} role="group" aria-label="Rate this topic">
          {([true, false] as const).map((helpful) => (
            <button key={String(helpful)} type="button" className={`${styles.secondaryButton} ${vote === helpful ? styles.voteButtonSelected : ""}`} aria-pressed={vote === helpful} disabled={isSending} onClick={() => void send(helpful)}>
              {helpful ? "Yes" : "No"}
            </button>
          ))}
        </div>
      ) : (
        <p className={styles.muted}><Link href={`/login?next=${encodeURIComponent(topicPath)}`}>Sign in</Link> to rate this topic.</p>
      )}
      <p className={styles.muted} aria-live="polite">{vote === false ? "Sorry about that. Our support team can help directly." : vote === true ? "Thanks for letting us know." : count > 0 ? `${count} ${count === 1 ? "person" : "people"} found this helpful.` : ""}</p>
      {errorMessage ? <p className={styles.error} role="alert">{errorMessage}</p> : null}
    </section>
  );
}
