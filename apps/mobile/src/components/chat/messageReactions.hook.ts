import { useCallback } from "react";

import type { LocallyStoredMessage } from "@/cache/messageHistory.type";
import { showToast } from "@/store/toast.store";

import { useChatControlSender } from "./chatControlSender.hook";

export function useMessageReactionToggle(conversationId: string | undefined) {
  const sendControl = useChatControlSender(conversationId);
  return useCallback(
    async (message: LocallyStoredMessage, emoji: string, shouldReact: boolean) => {
      if (!conversationId || message.deliveryStatus !== "sent" || message.kind === "control") return;
      const alreadyReacted = message.reactions?.some((reaction) => reaction.emoji === emoji && reaction.reactedByMe) ?? false;
      if (alreadyReacted === shouldReact) return;
      const sent = await sendControl({ type: "reaction", targetMessageId: message.id, emoji, remove: !shouldReact });
      if (!sent) showToast("Couldn't update your reaction", { tone: "error" });
    },
    [conversationId, sendControl],
  );
}
