"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { ErrorState } from "@/components/ui/feedback";
import { ChatMessagesSkeleton } from "@/components/ui/pageSkeletons";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { supportService } from "@/services/support.service";

import styles from "./help.module.css";
import { supportTicketsQueryKey } from "./supportTicketList";
import { SupportTicketRating } from "./supportTicketRating";
import { formatTicketDate, ticketStatusLabels } from "./ticketStatus.util";

const LIVE_CHAT_POLL_MS = 4000;

export function SupportTicketThread({ ticketId, initialScore }: { readonly ticketId: string; readonly initialScore?: number }) {
  const queryClient = useQueryClient();
  const ticket = useQuery({ queryKey: ["support", "ticket", ticketId], queryFn: () => supportService.fetchTicket(ticketId), refetchInterval: LIVE_CHAT_POLL_MS });
  const [draft, setDraft] = useState("");
  const unreadCount = ticket.data?.unreadCount ?? 0;
  useEffect(() => {
    if (unreadCount === 0) return;
    void supportService.markTicketRead(ticketId).then(() => queryClient.invalidateQueries({ queryKey: supportTicketsQueryKey })).catch(() => undefined);
  }, [unreadCount, ticketId, queryClient]);
  const reply = useMutation({
    mutationFn: (text: string) => supportService.replyToTicket(ticketId, text),
    onSuccess: () => {
      setDraft("");
      void ticket.refetch();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (draft.trim()) reply.mutate(draft.trim());
  }

  if (ticket.isLoading) return <ChatMessagesSkeleton label="Loading your request" />;
  if (ticket.isError || !ticket.data) {
    return <ErrorState description={ticket.isError ? readErrorMessageForDisplay(ticket.error) : "We couldn't find this request."} error={ticket.error} onRetry={() => void ticket.refetch()} />;
  }
  const details = ticket.data;
  const canReply = details.canReply !== false && details.status !== "closed";
  return (
    <div className={styles.page}>
      <div className={styles.row}>
        <h1 className={styles.title}>{details.subject}</h1>
        <span className={styles.status}>{ticketStatusLabels[details.status]}</span>
      </div>
      <p className={styles.muted}>{details.reference ? `${details.reference} · ` : ""}Opened {formatTicketDate(details.createdAt)}{details.linkedReference ? ` · Linked to ${details.linkedReference.label}` : ""}</p>
      <p className={styles.notice}>Support conversations are recorded for quality and safety and are not end-to-end encrypted. Never share passwords, PINs or one-time codes.</p>
      <ol className={styles.thread} aria-label="Conversation" aria-live="polite">
        {details.messages.map((message) => (
          <li key={message.id} className={`${styles.message} ${message.fromSupport ? "" : styles.mine}`}>
            <span className={styles.muted}>{message.authorName}</span>
            <span className={styles.bubble}>{message.text}</span>
            <time className={styles.muted} dateTime={message.createdAt}>{formatTicketDate(message.createdAt)}</time>
          </li>
        ))}
      </ol>
      {details.canRate ? <SupportTicketRating ticketId={ticketId} initialScore={initialScore} onRated={() => void ticket.refetch()} /> : null}
      {details.satisfactionScore ? <p className={styles.muted}>You rated this {details.satisfactionScore} out of 5. Thank you.</p> : null}
      {canReply ? (
        <form className={styles.page} onSubmit={submit}>
          <label className={styles.field}>
            Reply
            <textarea className={styles.textarea} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={5000} placeholder={details.status === "resolved" ? "Reply within 7 days to reopen this request" : "Write a reply to Zudomart Support"} />
          </label>
          {reply.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(reply.error)}</p> : null}
          <div className={styles.row}>
            <button type="submit" className={styles.button} disabled={!draft.trim() || reply.isPending}>{reply.isPending ? "Sending…" : "Send reply"}</button>
          </div>
        </form>
      ) : (
        <p className={styles.muted}>This request is closed. <Link href="/help/tickets/new">Contact support again</Link> if you still need help.</p>
      )}
    </div>
  );
}
