"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { createIdempotencyKey, readErrorMessageForDisplay } from "@/services/clientApi.service";
import { supportService } from "@/services/support.service";
import type { SupportLinkedReference, SupportTicketCategory } from "@/types/support.type";

import styles from "./help.module.css";
import { supportTicketsQueryKey } from "./supportTicketList";
import { ticketCategoryOptions } from "./ticketStatus.util";

const linkKinds = ["order", "payment", "live", "report", "dispute"] as const;

function readLinkedReference(searchParams: URLSearchParams): SupportLinkedReference | null {
  const kind = searchParams.get("linkKind");
  const id = searchParams.get("linkId");
  if (!kind || !id || !(linkKinds as readonly string[]).includes(kind) || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) return null;
  return { kind: kind as SupportLinkedReference["kind"], id, label: (searchParams.get("linkLabel") ?? `${kind} ${id}`).slice(0, 120) };
}

export function NewTicketForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const initialCategory = ticketCategoryOptions.find((option) => option.value === searchParams.get("category"))?.value ?? "order";
  const [category, setCategory] = useState<SupportTicketCategory>(initialCategory);
  const [linkedReference, setLinkedReference] = useState(() => readLinkedReference(new URLSearchParams(searchParams.toString())));
  const [subject, setSubject] = useState(() => (searchParams.get("subject") ?? "").trim().slice(0, 120));
  const [message, setMessage] = useState("");
  const idempotencyKey = useRef(createIdempotencyKey("ticket"));
  const create = useMutation({
    mutationFn: () => supportService.createTicket({ category, subject: subject.trim(), message: message.trim(), attachmentUrls: [], linkedReference }, idempotencyKey.current),
    onSuccess: (ticket) => {
      void queryClient.invalidateQueries({ queryKey: supportTicketsQueryKey });
      router.replace(`/help/tickets/${encodeURIComponent(ticket.id)}`);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <form className={styles.page} onSubmit={submit}>
      <label className={styles.field}>
        What do you need help with?
        <select className={styles.select} value={category} onChange={(event) => setCategory(event.target.value as SupportTicketCategory)}>
          {ticketCategoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      {linkedReference ? (
        <p className={styles.notice}>
          Linked to {linkedReference.label}. <button type="button" className={styles.secondaryButton} onClick={() => setLinkedReference(null)}>Remove link</button>
        </p>
      ) : null}
      <label className={styles.field}>
        Subject
        <input className={styles.input} value={subject} onChange={(event) => setSubject(event.target.value)} minLength={4} maxLength={120} required placeholder="For example, my order hasn't arrived" />
      </label>
      <label className={styles.field}>
        Tell us more
        <textarea className={styles.textarea} value={message} onChange={(event) => setMessage(event.target.value)} minLength={10} maxLength={5000} required placeholder={category === "developer" || category === "sandbox" ? "Include the environment, endpoint, request or event ID, and a redacted error. Never include credentials or customer message content." : "Include what happened and what you've tried. Add order numbers if they help."} />
      </label>
      <p className={styles.muted}>Never share your password, card PIN or one-time codes. Nantty will never ask for them.</p>
      {create.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(create.error)}</p> : null}
      <div className={styles.row}>
        <button type="submit" className={styles.button} disabled={create.isPending || subject.trim().length < 4 || message.trim().length < 10}>{create.isPending ? "Sending…" : "Send"}</button>
      </div>
    </form>
  );
}
