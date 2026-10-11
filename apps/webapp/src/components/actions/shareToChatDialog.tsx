"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/media";
import { ModalDialog } from "@/components/ui/modalDialog";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { useSession } from "@/components/providers/sessionProvider";
import { chatCryptoService, readChatCryptoErrorMessage } from "@/services/chatCrypto/chatCrypto.service";
import { useConversationDisplay } from "@/components/messages/conversationDisplay.hook";
import { messagesService } from "@/services/messages.service";
import type { Conversation } from "@/types";
import { chatSharesService, toShareReferenceKind, type ShareReferenceKind } from "@/services/webActions.service";

import styles from "./actionDialogs.module.css";
import { buildAbsoluteSiteUrl, buildPostPath, buildProductPath, buildStorePath } from "@/utils/seoPaths.util";

const shareLinkPathFor = (kind: ShareReferenceKind, referenceId: string): string | null => {
  if (kind === "post" || kind === "clip" || kind === "video") return buildPostPath(referenceId);
  if (kind === "product") return buildProductPath({ id: referenceId });
  if (kind === "store") return buildStorePath(referenceId);
  if (kind === "live") return `/live/${encodeURIComponent(referenceId)}`;
  return null;
};

const maximumChatsPerShare = 20;

function ShareConversationIdentity({ conversation }: { readonly conversation: Conversation }) {
  const display = useConversationDisplay(conversation, { loadMembersForFallback: false });
  return (
    <>
      <Avatar name={display.name} src={display.avatarSrc} size="sm" />
      <span className={styles.optionText}>
        <span className={styles.optionTitle}>{display.name}</span>
        {display.subtitle ? <span className={styles.optionMeta}>{display.subtitle}</span> : null}
      </span>
    </>
  );
}

interface ShareToChatDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly kind: ShareReferenceKind;
  readonly referenceId: string;
}

export function ShareToChatDialog({ isOpen, onClose, kind, referenceId }: ShareToChatDialogProps) {
  const queryClient = useQueryClient();
  const { viewer } = useSession();
  const [selectedConversationIds, setSelectedConversationIds] = useState<readonly string[]>([]);
  const [note, setNote] = useState("");
  const conversationsQuery = useQuery({ queryKey: ["conversations", "all"], queryFn: () => messagesService.fetchConversationList("all"), enabled: isOpen, retry: false });
  const shareMutation = useMutation({
    mutationFn: async () => {
      const text = note.trim();
      if (!viewer?.id) throw new Error("Sign in to share in chats.");
      const conversations = (conversationsQuery.data ?? []).filter((conversation) => selectedConversationIds.includes(conversation.id));
      const sealed = await Promise.all(
        conversations.map(async (conversation) => ({
          conversationId: conversation.id,
          encrypted: await chatCryptoService.encryptForConversation(conversation, viewer.id, { text, sharedContent: { kind: toShareReferenceKind(kind), id: referenceId } }),
        })),
      );
      const result = await chatSharesService.shareIntoChats(selectedConversationIds, kind, referenceId, sealed.map(({ conversationId, encrypted }) => ({ conversationId, ...encrypted.encryption })));
      await Promise.all(sealed.map(({ encrypted }) => encrypted.confirmSent(null)));
      return result;
    },
    onSuccess: (result) => {
      showToast({ text: result.sentCount === 1 ? "Sent to 1 chat" : `Sent to ${result.sentCount} chats`, actionLabel: "Open messages", actionHref: "/chats" });
      setSelectedConversationIds([]);
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onClose();
    },
  });

  function toggleConversation(conversationId: string) {
    setSelectedConversationIds((current) =>
      current.includes(conversationId) ? current.filter((id) => id !== conversationId) : current.length >= maximumChatsPerShare ? current : [...current, conversationId],
    );
  }

  const shareLinkPath = shareLinkPathFor(kind, referenceId);
  async function copyShareLink(path: string) {
    try {
      await navigator.clipboard.writeText(buildAbsoluteSiteUrl(path));
      showToast({ text: "Link copied" });
    } catch {
      showToast({ text: "Couldn't copy the link", tone: "error" });
    }
  }

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Send in chat"
      description={`Pick up to ${maximumChatsPerShare} chats.`}
      intent="share"
      busy={shareMutation.isPending}
      errorMessage={shareMutation.isError ? (readChatCryptoErrorMessage(shareMutation.error) ?? readErrorMessageForDisplay(shareMutation.error)) : null}
      footer={
        <>
          {shareLinkPath ? (
            <Button variant="secondary" onClick={() => void copyShareLink(shareLinkPath)}>
              Copy link
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => shareMutation.mutate()} disabled={selectedConversationIds.length === 0} busy={shareMutation.isPending}>
            {selectedConversationIds.length > 1 ? `Send to ${selectedConversationIds.length}` : "Send"}
          </Button>
        </>
      }
    >
      {conversationsQuery.isLoading ? (
        <div className={styles.optionList}>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} height={48} />
          ))}
        </div>
      ) : (conversationsQuery.data ?? []).length === 0 ? (
        <EmptyState title="No chats yet" description="Start a conversation from someone's profile first." />
      ) : (
        <fieldset className={styles.optionList}>
          <legend className="visuallyHidden">Chats</legend>
          {conversationsQuery.data?.map((conversation) => (
            <label key={conversation.id} className={styles.option}>
              <input type="checkbox" checked={selectedConversationIds.includes(conversation.id)} onChange={() => toggleConversation(conversation.id)} />
              <ShareConversationIdentity conversation={conversation} />
            </label>
          ))}
        </fieldset>
      )}
      <label className={styles.label} htmlFor="share-note">
        Add a note (optional)
      </label>
      <textarea id="share-note" className={styles.textarea} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
    </ModalDialog>
  );
}
