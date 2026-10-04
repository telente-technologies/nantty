"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { supportService } from "@/services/support.service";

import styles from "./help.module.css";

export function SupportTicketRating({ ticketId, initialScore, onRated }: { readonly ticketId: string; readonly initialScore?: number; readonly onRated: () => void }) {
  const [score, setScore] = useState<number | null>(initialScore !== undefined && initialScore >= 1 && initialScore <= 5 ? initialScore : null);
  const rate = useMutation({ mutationFn: (value: number) => supportService.rateTicket(ticketId, value, null), onSuccess: onRated });
  return (
    <fieldset className={styles.panel}>
      <legend className={styles.cardTitle}>How happy are you with the help you got?</legend>
      <p className={styles.muted}>1 is not happy, 5 is very happy.</p>
      <div className={styles.row} role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} type="button" role="radio" aria-checked={score === value} className={`${styles.secondaryButton} ${score === value ? styles.voteButtonSelected : ""}`} onClick={() => setScore(value)}>
            {value}
          </button>
        ))}
      </div>
      {rate.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(rate.error)}</p> : null}
      <div className={styles.row}>
        <button type="button" className={styles.button} disabled={score === null || rate.isPending} onClick={() => score !== null && rate.mutate(score)}>Send rating</button>
      </div>
    </fieldset>
  );
}
