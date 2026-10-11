"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modalDialog";
import { createIdempotencyKey, readErrorMessageForDisplay } from "@/services/clientApi.service";
import { chatReportsService } from "@/services/chatReports.service";
import type { ChatReportInput, ChatReportReason, Message } from "@/types";

import { buildEvidenceMessage, hashEvidenceForIntegrity, listReportableMessages } from "./chatReportEvidence.util";
import { ChatReportDoneActions } from "./chatReportDoneActions";
import { ChatReportEvidenceFields } from "./chatReportEvidenceFields";
import { ChatReportReasonFields } from "./chatReportReasonFields";
import { DEFAULT_LAST_MESSAGES_COUNT } from "./chatReportReasons.constant";
import { describeChatReportTarget, doesChatReportTargetCarryEvidence, type ChatReportEvidenceMode, type ChatReportTarget } from "./chatReportTarget.type";

type Step = "reason" | "evidence" | "done";

interface ChatReportDialogProps {
  readonly target: ChatReportTarget | null;
  readonly messages: readonly Message[];
  readonly viewerId: string;
  readonly onClose: () => void;
}

export function ChatReportDialog({ target, messages, viewerId, onClose }: ChatReportDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("reason");
  const [reason, setReason] = useState<ChatReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [mode, setMode] = useState<ChatReportEvidenceMode>("last_messages");
  const [lastMessagesCount, setLastMessagesCount] = useState<number>(DEFAULT_LAST_MESSAGES_COUNT);
  const [pickedMessageIds, setPickedMessageIds] = useState<ReadonlySet<string>>(new Set());
  const idempotencyKey = useRef(createIdempotencyKey("chatreport"));

  useEffect(() => {
    if (!target) return;
    setStep("reason");
    setReason(null);
    setDetails("");
    setLastMessagesCount(DEFAULT_LAST_MESSAGES_COUNT);
    setMode(target.message ? "picked_messages" : "last_messages");
    setPickedMessageIds(new Set(target.message ? [target.message.id] : []));
    idempotencyKey.current = createIdempotencyKey("chatreport");
  }, [target]);

  const carriesEvidence = !!target && doesChatReportTargetCarryEvidence(target);
  const reportable = useMemo(() => listReportableMessages(messages), [messages]);
  const evidenceMessages = mode === "last_messages" ? reportable.slice(-lastMessagesCount) : reportable.filter((message) => pickedMessageIds.has(message.id));

  const submission = useMutation({
    mutationFn: async () => {
      const senderNameById = new Map(messages.flatMap((message) => (message.sender ? [[message.senderId, message.sender.name] as const] : [])));
      const evidence = carriesEvidence ? evidenceMessages.map((message) => buildEvidenceMessage(message, viewerId, senderNameById)) : [];
      const input: ChatReportInput = {
        targetType: target!.kind,
        targetId: target!.kind === "message" ? target!.message!.id : target!.kind === "user" ? target!.reportedUser!.id : target!.conversationId,
        conversationId: target!.conversationId,
        reportedUserId: target!.reportedUser?.id ?? null,
        reason: reason!,
        details: details.trim(),
        blockReportedUser: target!.alsoBlock,
        evidence,
        evidenceSelection: evidence.length > 0 ? mode : null,
        evidenceHash: evidence.length > 0 ? await hashEvidenceForIntegrity(evidence) : null,
      };
      return chatReportsService.submitChatReport(input, idempotencyKey.current);
    },
    onSuccess: () => {
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["reports", "mine"] });
      if (target?.alsoBlock) queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const canContinue = !!reason && !(reason === "other" && details.trim().length === 0);
  const closeAndReset = () => {
    submission.reset();
    onClose();
  };
  const submitReport = () => submission.mutate();

  return (
    <ModalDialog
      isOpen={!!target}
      onClose={closeAndReset}
      title={step === "done" ? "Thanks, we'll review this" : target ? `Report ${describeChatReportTarget(target)}` : "Report"}
      description={step === "done" ? undefined : "Reports are anonymous. The other person won't be told who reported them."}
      intent={step === "done" ? "success" : "report"}
      busy={submission.isPending}
      errorMessage={submission.isError ? readErrorMessageForDisplay(submission.error) : null}
      footer={
        step === "done" ? (
          <>
            <Link href="/settings/reports" onClick={closeAndReset}>Your reports</Link>
            <Button onClick={closeAndReset}>Done</Button>
          </>
        ) : step === "reason" ? (
          <>
            <Button variant="secondary" onClick={closeAndReset}>Cancel</Button>
            {carriesEvidence ? (
              <Button onClick={() => setStep("evidence")} disabled={!canContinue}>Next</Button>
            ) : (
              <Button variant={target?.alsoBlock ? "danger" : "primary"} onClick={submitReport} disabled={!canContinue} busy={submission.isPending}>{target?.alsoBlock ? "Report and block" : "Send report"}</Button>
            )}
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep("reason")}>Back</Button>
            <Button variant={target?.alsoBlock ? "danger" : "primary"} onClick={submitReport} disabled={evidenceMessages.length === 0} busy={submission.isPending}>{target?.alsoBlock ? "Send and block" : "Send report"}</Button>
          </>
        )
      }
    >
      {target && step === "reason" ? <ChatReportReasonFields reason={reason} details={details} onChangeReason={setReason} onChangeDetails={setDetails} /> : null}
      {target && step === "evidence" ? (
        <ChatReportEvidenceFields
          messages={reportable}
          mode={mode}
          lastMessagesCount={lastMessagesCount}
          pickedMessageIds={pickedMessageIds}
          selectedEvidenceCount={evidenceMessages.length}
          onChangeMode={setMode}
          onChangeLastMessagesCount={setLastMessagesCount}
          onTogglePickedMessage={(messageId) =>
            setPickedMessageIds((current) => {
              const next = new Set(current);
              if (next.has(messageId)) next.delete(messageId);
              else next.add(messageId);
              return next;
            })
          }
        />
      ) : null}
      {target && step === "done" ? <ChatReportDoneActions target={target} isUrgent={reason === "child_safety"} /> : null}
    </ModalDialog>
  );
}
