"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/formFields";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { OnlineOrder } from "@/types/order.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./orders.module.css";

const mutedTimelineKinds = new Set(["cancelled", "rejected", "refunded", "delivery_failed", "returned"]);

export function OrderTimelinePanel({ order }: { readonly order: OnlineOrder }) {
  const events = [...order.timeline].reverse();
  return (
    <Panel title="Timeline" description="Every step of this order, newest first.">
      <ol className={styles.timeline}>
        {events.map((event) => (
          <li key={event.id} className={styles.timelineItem}>
            <span className={`${styles.timelineDot} ${mutedTimelineKinds.has(event.kind) ? styles.timelineDotMuted : ""}`} aria-hidden="true" />
            <span className={styles.primaryCell}>
              <span>{event.summary}</span>
              <span className={styles.muted}>
                {formatDateTimeForDisplay(event.createdAt)}
                {event.actorName ? ` · ${event.actorName}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function OrderNotesPanel({ order, canAddNotes, onOrderChanged }: { readonly order: OnlineOrder; readonly canAddNotes: boolean; readonly onOrderChanged: (order: OnlineOrder) => void }) {
  const { showToast } = useToast();
  const [noteText, setNoteText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function addInternalNoteToOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (noteText.trim().length < 2) {
      setErrorMessage("Write at least 2 characters.");
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const updatedOrder = await sendSellerApiRequest<OnlineOrder>(`/seller/orders/${order.id}/notes`, { method: "POST", body: { body: noteText.trim() } });
      onOrderChanged(updatedOrder);
      setNoteText("");
      showToast("Note added.");
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Panel title="Internal notes" description="Only your team sees these. The customer never does.">
      <div className={styles.formStack}>
        {order.notes.length > 0 ? (
          <ul className={styles.noteList}>
            {order.notes.map((note) => (
              <li key={note.id} className={styles.noteItem}>
                <p>{note.body}</p>
                <p className={styles.muted}>
                  {note.authorName} · {formatDateTimeForDisplay(note.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>No notes yet.</p>
        )}
        {canAddNotes ? (
          <form className={styles.formStack} onSubmit={addInternalNoteToOrder}>
            <TextAreaField label="Add a note" hideLabel placeholder="For example: customer wants it wrapped as a gift" rows={2} value={noteText} maxLength={1000} onChange={(event) => setNoteText(event.target.value)} errorMessage={errorMessage} />
            <div className={styles.actionRow}>
              <Button type="submit" size="small" isBusy={isSaving}>
                Add note
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </Panel>
  );
}
