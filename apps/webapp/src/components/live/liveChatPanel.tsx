"use client";

import { MentionText } from "@/components/mentions/mentionText";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { SignInRequiredState } from "@/components/auth/signInRequiredState";
import { useSession } from "@/components/providers/sessionProvider";
import { Avatar } from "@/components/ui/media";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { liveService } from "@/services/webActions.service";

import panelStyles from "./livePanels.module.css";

export function LiveChatPanel({ liveId, isRealtime = false }: { readonly liveId: string; readonly isRealtime?: boolean }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const { viewer } = useSession();
  const commentsQuery = useQuery({ queryKey: ["live", liveId, "comments"], queryFn: () => liveService.fetchLiveComments(liveId), refetchInterval: isRealtime ? 30_000 : 5_000, retry: false, enabled: viewer !== null });
  const sendMutation = useMutation({
    mutationFn: (text: string) => liveService.postLiveComment(liveId, text),
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["live", liveId, "comments"] });
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });

  function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (text) requireAuthThen(() => sendMutation.mutate(text), "Sign in to chat in this live.");
  }

  return (
    <section className={panelStyles.chat} aria-labelledby="live-chat-title">
      <h2 id="live-chat-title" className={panelStyles.sectionTitle}>
        Live chat
      </h2>
      {viewer === null ? <SignInRequiredState title="Sign in to see the chat" description="Sign in or create a free account to read and join the live chat." /> : null}
      <ol className={panelStyles.chatList} aria-live="polite">
        {(commentsQuery.data?.data ?? []).map((comment) => (
          <li key={comment.id} className={[panelStyles.chatRow, comment.kind === "gift" ? panelStyles.chatRowGift : ""].join(" ")}>
            <Avatar name={comment.author.name} src={comment.author.avatarUrl} size="xs" />
            <p>
              <strong>{comment.author.name}</strong> {comment.kind === "joined" ? "joined" : comment.gift ? `sent ${comment.gift.quantity} × ${comment.gift.emoji} ${comment.gift.name}` : <MentionText text={comment.text} />}
            </p>
          </li>
        ))}
      </ol>
      <form className={panelStyles.chatComposer} onSubmit={submitDraft}>
        <label htmlFor="live-chat-input" className="visuallyHidden">
          Say something
        </label>
        <input id="live-chat-input" className={panelStyles.chatInput} value={draft} maxLength={200} placeholder="Say something…" onChange={(event) => setDraft(event.target.value)} />
        <button type="submit" className={panelStyles.chatSend} disabled={!draft.trim() || sendMutation.isPending}>
          Send
        </button>
      </form>
    </section>
  );
}
