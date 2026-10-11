"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { ShareItemDialog, type SharedPick } from "@/components/messages/shareItemDialog";
import { Button, IconButton } from "@/components/ui/button";
import type { OutgoingDraft } from "@/hooks/useStoreThread.hook";
import { storeChatEngine } from "@/services/chatCrypto/storeChatEngine";
import { chatAttachmentKindOf, maximumChatAttachmentBytes } from "@/utils/storeChat.util";

import styles from "./messages.module.css";

const typingIdleMs = 4_000;

interface ThreadComposerProps {
  readonly conversationId: string;
  readonly order: { readonly id: string; readonly orderNumber: string } | null;
  readonly disabled: boolean;
  readonly onSend: (draft: OutgoingDraft) => void;
  readonly onError: (message: string) => void;
}

export function ThreadComposer({ conversationId, order, disabled, onSend, onError }: ThreadComposerProps) {
  const [draftReply, setDraftReply] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const typingSentAt = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function signalTyping(text: string) {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (text.trim() === "") {
      typingSentAt.current = 0;
      storeChatEngine.sendTyping(conversationId, false);
      return;
    }
    if (Date.now() - typingSentAt.current > 3_000) {
      typingSentAt.current = Date.now();
      storeChatEngine.sendTyping(conversationId, true);
    }
    typingTimer.current = setTimeout(() => {
      typingSentAt.current = 0;
      storeChatEngine.sendTyping(conversationId, false);
    }, typingIdleMs);
  }

  function sendText(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const text = draftReply.trim();
    if (text === "" || disabled) return;
    onSend({ kind: "text", input: { text } });
    setDraftReply("");
    signalTyping("");
  }

  function sendOnEnterWithoutShift(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendText();
    }
  }

  function attachFiles(files: FileList | null) {
    for (const file of Array.from(files ?? []).slice(0, 10)) {
      if (file.size > maximumChatAttachmentBytes) {
        onError(`${file.name} is larger than 100 MB.`);
        continue;
      }
      const kind = chatAttachmentKindOf(file);
      onSend({ kind, input: { text: "" }, file, attachmentKind: kind });
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function share(pick: SharedPick) {
    if (pick.kind === "product") onSend({ kind: "shared", input: { text: "", sharedContent: { kind: "product", id: pick.id } } });
    else onSend({ kind: "shared", input: { text: "", sharedContent: { kind: "order", id: pick.id } } });
  }

  return (
    <form className={styles.composer} onSubmit={sendText}>
      <div className={styles.composerTools}>
        <IconButton iconName="paperclip24" label="Attach photos, videos or documents" disabled={disabled} onClick={() => fileInput.current?.click()} />
        <IconButton iconName="shareFat24" label="Share a product or order" disabled={disabled} onClick={() => setIsSharing(true)} />
      </div>
      <input ref={fileInput} type="file" hidden multiple accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={(event) => attachFiles(event.target.files)} />
      <label htmlFor="conversation-reply" className="visuallyHidden">Reply</label>
      <textarea
        id="conversation-reply" className={styles.composerInput} placeholder="Write a reply…" rows={1} maxLength={4000} value={draftReply} disabled={disabled}
        onChange={(event) => {
          setDraftReply(event.target.value);
          signalTyping(event.target.value);
        }}
        onKeyDown={sendOnEnterWithoutShift}
      />
      <Button type="submit" variant="primary" iconName="paperPlaneTilt24" disabled={disabled || draftReply.trim().length === 0}>Send</Button>
      <ShareItemDialog isOpen={isSharing} order={order} onClose={() => setIsSharing(false)} onShare={share} />
    </form>
  );
}
