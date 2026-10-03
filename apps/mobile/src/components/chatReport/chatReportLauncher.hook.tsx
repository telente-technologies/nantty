import { useState } from "react";

import type { LocallyStoredMessage } from "@/cache/messageHistory.type";
import type { Conversation, UserSummary } from "@/types";
import { requireAuthThen } from "@/utils/requireAuth.util";

import { ChatReportSheet } from "./chatReportSheet";
import type { ChatReportTarget } from "./chatReportTarget.type";

export function useChatReportLauncher(conversation: Conversation | undefined) {
  const [target, setTarget] = useState<ChatReportTarget | null>(null);
  const open = (next: Omit<ChatReportTarget, "conversationId">) => {
    if (!conversation) return;
    requireAuthThen(() => setTarget({ ...next, conversationId: conversation.id }), undefined, "report");
  };
  const peer = conversation?.peer ?? null;
  return {
    reportUser: (alsoBlock = false) => open({ kind: "user", reportedUser: peer, message: null, alsoBlock }),
    reportConversation: () => open({ kind: "conversation", reportedUser: peer, message: null, alsoBlock: false }),
    reportGroup: () => open({ kind: "group", reportedUser: null, message: null, alsoBlock: false }),
    reportMember: (member: UserSummary) => open({ kind: "user", reportedUser: member, message: null, alsoBlock: false }),
    reportMessage: (message: LocallyStoredMessage, sender: UserSummary | null) =>
      open({ kind: "message", reportedUser: sender ?? peer, message, alsoBlock: false }),
    reportSheet: <ChatReportSheet target={target} onClose={() => setTarget(null)} />,
  };
}
