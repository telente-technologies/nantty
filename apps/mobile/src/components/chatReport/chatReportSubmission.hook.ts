import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import type { LocallyStoredMessage } from "@/cache/messageHistory.type";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { chatReportsService } from "@/services/chat/chatReports.service";
import { useAuthStore } from "@/store/auth.store";
import type { ChatReportInput } from "@/types";
import { buildEvidenceMessage, hashEvidenceForIntegrity, listReportableMessagesOldestFirst, pickLastReportableMessages } from "@/utils/chatReportEvidence.util";

import type { ChatReportDraft } from "./chatReportDraft.hook";
import { doesChatReportTargetCarryEvidence, type ChatReportTarget } from "./chatReportTarget.type";

export function useChatReportSubmission(target: ChatReportTarget | null, draft: ChatReportDraft, messages: readonly LocallyStoredMessage[]) {
  const queryClient = useQueryClient();
  const myUserId = useAuthStore((state) => state.user?.id ?? "u_me");
  const idempotencyKey = useRef(generateIdempotencyKey());

  const selectEvidenceMessages = () => {
    if (!target || !doesChatReportTargetCarryEvidence(target)) return [];
    if (draft.evidenceMode === "last_messages") return pickLastReportableMessages(messages, draft.lastMessagesCount);
    return listReportableMessagesOldestFirst(messages).filter((message) => draft.pickedMessageIds.has(message.id));
  };

  const submission = useMutation({
    mutationFn: async () => {
      if (!target || !draft.reason) throw new Error("Choose a reason first.");
      const senderNameById = new Map(messages.flatMap((message) => (message.sender ? [[message.senderId, message.sender.name] as const] : [])));
      const evidence = selectEvidenceMessages().map((message) => buildEvidenceMessage(message, myUserId, senderNameById));
      const input: ChatReportInput = {
        targetType: target.kind,
        targetId: target.kind === "message" ? target.message!.id : target.kind === "user" ? target.reportedUser!.id : target.conversationId,
        conversationId: target.conversationId,
        reportedUserId: target.reportedUser?.id ?? null,
        reason: draft.reason,
        details: draft.details.trim(),
        blockReportedUser: target.alsoBlock,
        evidence,
        evidenceSelection: evidence.length > 0 ? draft.evidenceMode : null,
        evidenceHash: evidence.length > 0 ? await hashEvidenceForIntegrity(evidence) : null,
      };
      return chatReportsService.submitChatReport(input, idempotencyKey.current);
    },
    onSuccess: () => {
      draft.setStep("done");
      queryClient.invalidateQueries({ queryKey: ["reports", "mine"] });
      if (target?.alsoBlock) {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        queryClient.invalidateQueries({ queryKey: ["conversation"] });
        queryClient.invalidateQueries({ queryKey: ["users", "me", "blocked"] });
      }
    },
  });

  const resetSubmission = () => {
    idempotencyKey.current = generateIdempotencyKey();
    submission.reset();
  };
  return { submission, resetSubmission, selectedEvidenceCount: selectEvidenceMessages().length };
}
