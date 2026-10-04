"use client";

import { useState, type FormEvent } from "react";

import { useAdminSession } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { SelectField, TextAreaField } from "@/components/ui/formFields";
import { SegmentedTabs } from "@/components/ui/tabs";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { expandSupportMacroVariables, fetchSupportMacros, sendSupportTicketReply } from "@/services/supportApi.service";
import type { SupportTicketDetail, SupportTicketStatus, SupportTicketSummary } from "@/types/support.type";

import styles from "./ticketDetailWorkspace.module.css";

type ReplyMode = "reply" | "note";

const statusAfterReplyOptions = [
  { value: "AWAITING_USER", label: "Send and wait for the customer" },
  { value: "AWAITING_SUPPORT", label: "Send and keep it with support" },
  { value: "RESOLVED", label: "Send and mark resolved" },
];

export function TicketReplyBox({ ticket, onSent }: { readonly ticket: SupportTicketSummary; readonly onSent: (detail: SupportTicketDetail, message: string) => void }) {
  const { admin } = useAdminSession();
  const [mode, setMode] = useState<ReplyMode>("reply");
  const [body, setBody] = useState("");
  const [statusAfterReply, setStatusAfterReply] = useState<SupportTicketStatus>("AWAITING_USER");
  const macros = useAdminQuery((signal) => fetchSupportMacros(signal), "reply-macros");
  const replyMutation = useAdminMutation((input: { body: string; isInternalNote: boolean; statusAfterReply?: SupportTicketStatus }) => sendSupportTicketReply(ticket.id, input));
  const isClosed = ticket.status === "CLOSED";
  const macroOptions = [{ value: "", label: "Insert a macro…" }, ...(macros.data?.items ?? []).filter((macro) => !macro.category || macro.category === ticket.category).map((macro) => ({ value: macro.id, label: macro.title }))];

  function insertMacro(macroId: string) {
    const macro = macros.data?.items.find((candidate) => candidate.id === macroId);
    if (!macro) return;
    const expanded = expandSupportMacroVariables(macro.body, { "user.displayName": ticket.requester.displayName, "user.username": `@${ticket.requester.username}`, "ticket.id": ticket.id, "agent.name": admin.name });
    setBody((current) => (current.trim() ? `${current.trimEnd()}\n\n${expanded}` : expanded));
  }

  async function submitReply(event: FormEvent) {
    event.preventDefault();
    const isInternalNote = mode === "note";
    const detail = await replyMutation.run({ body: body.trim(), isInternalNote, statusAfterReply: isInternalNote ? undefined : statusAfterReply });
    if (!detail) return;
    setBody("");
    onSent(detail, isInternalNote ? "Internal note added" : "Reply sent to the customer");
  }

  return (
    <form className={`${styles.replyBox} ${mode === "note" ? styles.noteMode : ""}`} onSubmit={submitReply}>
      <div className={styles.replyToolbar}>
        <SegmentedTabs label="Message type" items={[{ key: "reply", label: "Reply to customer" }, { key: "note", label: "Internal note" }]} activeKey={mode} onChange={setMode} />
        {mode === "reply" ? <SelectField label="Macro" isLabelHidden options={macroOptions} value="" onChange={(event) => insertMacro(event.target.value)} disabled={!macros.data} /> : null}
      </div>
      <TextAreaField label={mode === "reply" ? `Reply to ${ticket.requester.displayName}` : "Note for other agents"} isLabelHidden value={body} onChange={(event) => setBody(event.target.value)} rows={5} maxLength={5000} placeholder={mode === "reply" ? (isClosed ? "Reopen the ticket to reply to the customer." : "Write a reply the customer will see in the app and by email") : "Only admins can see internal notes"} disabled={mode === "reply" && isClosed} />
      {replyMutation.errorMessage ? <InlineError message={replyMutation.errorMessage} /> : null}
      <div className={styles.replyActions}>
        {mode === "reply" ? <SelectField label="After sending" isLabelHidden options={statusAfterReplyOptions} value={statusAfterReply} onChange={(event) => setStatusAfterReply(event.target.value as SupportTicketStatus)} /> : <span />}
        <Button type="submit" variant="primary" iconName={mode === "reply" ? "chatCircle24" : "textIndent24"} isBusy={replyMutation.isRunning} disabled={body.trim().length < 2 || (mode === "reply" && isClosed)}>
          {mode === "reply" ? "Send reply" : "Add note"}
        </Button>
      </div>
    </form>
  );
}
