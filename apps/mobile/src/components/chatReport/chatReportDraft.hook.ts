import { useEffect, useState } from "react";

import type { ChatReportReason } from "@/types";

import { DEFAULT_LAST_MESSAGES_COUNT } from "./chatReportReasons.constant";
import type { ChatReportTarget } from "./chatReportTarget.type";

export type ChatReportStep = "reason" | "evidence" | "done";
export type ChatReportEvidenceMode = "last_messages" | "picked_messages";

export function useChatReportDraft(target: ChatReportTarget | null) {
  const [step, setStep] = useState<ChatReportStep>("reason");
  const [reason, setReason] = useState<ChatReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [evidenceMode, setEvidenceMode] = useState<ChatReportEvidenceMode>("last_messages");
  const [lastMessagesCount, setLastMessagesCount] = useState<number>(DEFAULT_LAST_MESSAGES_COUNT);
  const [pickedMessageIds, setPickedMessageIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!target) return;
    setStep("reason");
    setReason(null);
    setDetails("");
    setLastMessagesCount(DEFAULT_LAST_MESSAGES_COUNT);
    setEvidenceMode(target.message ? "picked_messages" : "last_messages");
    setPickedMessageIds(new Set(target.message ? [target.message.id] : []));
  }, [target]);

  const togglePickedMessage = (messageId: string) =>
    setPickedMessageIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });

  return {
    step, setStep, reason, setReason, details, setDetails,
    evidenceMode, setEvidenceMode, lastMessagesCount, setLastMessagesCount, pickedMessageIds, togglePickedMessage,
  };
}

export type ChatReportDraft = ReturnType<typeof useChatReportDraft>;
