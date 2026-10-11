"use client";

import { useState, type FormEvent } from "react";

import { useAdminSession } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ErrorBlock, InlineError, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { SelectField, TextAreaField } from "@/components/ui/formFields";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { claimLiveChat, endLiveChat, fetchLiveChatDetail, sendLiveChatMessage } from "@/services/supportOutreachApi.service";
import { expandSupportMacroVariables, fetchSupportMacros } from "@/services/supportApi.service";
import type { LiveChatDetail } from "@/types/supportOutreach.type";

import { TicketConversation } from "./ticketConversation";

export function LiveChatPanel({ chatId, onClose, onChanged }: { readonly chatId: string; readonly onClose: () => void; readonly onChanged: () => void }) {
  const { admin } = useAdminSession();
  const { data: detail, errorMessage, error: queryError, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchLiveChatDetail(chatId, signal), chatId);
  const macros = useAdminQuery((signal) => fetchSupportMacros(signal), "chat-macros");
  const [body, setBody] = useState("");
  const mutation = useAdminMutation(async (action: { kind: "claim" | "end" | "send"; body?: string }) => {
    if (action.kind === "claim") return claimLiveChat(chatId);
    if (action.kind === "end") return endLiveChat(chatId);
    return sendLiveChatMessage(chatId, action.body ?? "");
  });

  async function run(action: { kind: "claim" | "end" | "send"; body?: string }) {
    const updated: LiveChatDetail | null = await mutation.run(action);
    if (!updated) return;
    replaceData(() => updated);
    if (action.kind === "send") setBody("");
    onChanged();
  }

  function insertMacro(macroId: string) {
    const macro = macros.data?.items.find((candidate) => candidate.id === macroId);
    if (!macro || !detail) return;
    const expanded = expandSupportMacroVariables(macro.body, { "user.displayName": detail.chat.user.displayName, "user.username": `@${detail.chat.user.username}`, "ticket.id": detail.chat.id, "agent.name": admin.name });
    setBody((current) => (current.trim() ? `${current.trimEnd()}\n\n${expanded}` : expanded));
  }

  const chat = detail?.chat;
  const isMine = chat?.assignee?.id === admin.id;
  const canReply = chat !== undefined && chat.status === "ACTIVE" && isMine;
  const macroOptions = [{ value: "", label: "Insert a canned reply…" }, ...(macros.data?.items ?? []).map((macro) => ({ value: macro.id, label: macro.title }))];

  function submit(event: FormEvent) {
    event.preventDefault();
    void run({ kind: "send", body: body.trim() });
  }

  return (
    <SidePanel isOpen onClose={onClose} width="wide" title={chat ? chat.topic : "Live chat"} subtitle={chat ? <UserIdentity user={chat.user} size={22} /> : null}
      footer={chat && chat.status !== "ENDED" ? (<>{!isMine ? <Button size="small" variant="primary" isBusy={mutation.isRunning} onClick={() => run({ kind: "claim" })}>Take this chat</Button> : null}{isMine ? <Button size="small" variant="quietDanger" onClick={() => run({ kind: "end" })}>End chat</Button> : null}</>) : null}>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !detail ? <LoadingBlock /> : null}
      {detail && chat ? (
        <>
          <NoticeBanner tone="caution" title="Recorded, not end-to-end encrypted">This conversation is saved so it can be reviewed. Opening it is written to the audit log. Never ask for passwords or card numbers.</NoticeBanner>
          <StatusBadge status={chat.status} />
          <TicketConversation messages={detail.messages} />
          {canReply ? (
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SelectField label="Canned replies" isLabelHidden options={macroOptions} value="" onChange={(event) => insertMacro(event.target.value)} disabled={!macros.data} />
              <TextAreaField label="Message" isLabelHidden rows={3} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a message the customer sees straight away" />
              {mutation.errorMessage ? <InlineError message={mutation.errorMessage} /> : null}
              <Button type="submit" variant="primary" isBusy={mutation.isRunning} disabled={body.trim().length === 0}>Send</Button>
            </form>
          ) : mutation.errorMessage ? <InlineError message={mutation.errorMessage} /> : null}
        </>
      ) : null}
    </SidePanel>
  );
}
