"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/formFields";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { Customer } from "@/types/customer.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./customers.module.css";

export function CustomerNotesPanel({ customer, onCustomerChanged }: { readonly customer: Customer; readonly onCustomerChanged: (customer: Customer) => void }) {
  const { showToast } = useToast();
  const [noteText, setNoteText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function addCustomerNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedNote = noteText.trim();
    if (trimmedNote.length < 2 || trimmedNote.length > 1000) {
      setErrorMessage("Write a note (2–1,000 characters).");
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      onCustomerChanged(await sendSellerApiRequest<Customer>(`/seller/customers/${customer.id}/notes`, { method: "POST", body: { body: trimmedNote } }));
      setNoteText("");
      showToast("Note added.");
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Panel title="Notes" description="Only your team can see these.">
      <form onSubmit={addCustomerNote} noValidate style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <TextAreaField label="New note" hideLabel placeholder="e.g. Prefers delivery after 5pm" value={noteText} onChange={(event) => setNoteText(event.target.value)} maxLength={1000} errorMessage={errorMessage} />
        <div>
          <Button type="submit" size="small" isBusy={isSaving}>Add note</Button>
        </div>
      </form>
      <ul className={styles.noteList}>
        {customer.notes.map((note) => (
          <li key={note.id} className={styles.note}>
            <p>{note.body}</p>
            <p className={styles.noteMeta}>{note.author.name} · {formatDateTimeForDisplay(note.createdAt)}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
