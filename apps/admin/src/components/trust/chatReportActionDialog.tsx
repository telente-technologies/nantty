"use client";

import { useState } from "react";

import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { SelectField } from "@/components/ui/formFields";
import { suspensionDurationOptions } from "@/constants/trustOptions.constant";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { applyActionToChatReport } from "@/services/chatReportsApi.service";
import type { AdminPermission } from "@/constants/adminPermissions.constant";
import type { ChatReportAction, ChatReportDetail } from "@/types/chatReport.type";

interface ChatActionPresentation {
  readonly title: string;
  readonly confirmLabel: string;
  readonly isDestructive: boolean;
  readonly requiresStepUp: boolean;
  readonly permission: AdminPermission;
  readonly consequences: (report: ChatReportDetail) => string[];
}

const reporterNotice = "The reporter is told \"We took action\" with no details about the other person.";

export const chatReportActionPresentations: Record<ChatReportAction, ChatActionPresentation> = {
  DISMISS: { title: "Dismiss this report", confirmLabel: "Dismiss", isDestructive: false, requiresStepUp: false, permission: "chat-reports:review", consequences: () => ["No action is taken against the reported account.", "The reporter is told \"No violation found\" and reminded of block, mute and restrict."] },
  WARN_USER: { title: "Warn the reported user", confirmLabel: "Send warning", isDestructive: false, requiresStepUp: false, permission: "users:moderate", consequences: (report) => [`@${report.reportedUser?.username ?? "user"} gets a warning notification with your reason. They are never told who reported them.`, reporterNotice] },
  RESTRICT_USER: { title: "Restrict messaging", confirmLabel: "Restrict messaging", isDestructive: false, requiresStepUp: false, permission: "users:restrict", consequences: (report) => [`@${report.reportedUser?.username ?? "user"} can't send messages for 7 days.`, reporterNotice] },
  SUSPEND_USER: { title: "Suspend the reported user", confirmLabel: "Suspend user", isDestructive: true, requiresStepUp: false, permission: "users:suspend", consequences: (report) => [`@${report.reportedUser?.username ?? "user"} is signed out and enters the 120-day deletion flow unless reinstated.`, reporterNotice] },
  BAN_USER: { title: "Ban the reported user", confirmLabel: "Ban user", isDestructive: true, requiresStepUp: true, permission: "users:ban", consequences: (report) => [`@${report.reportedUser?.username ?? "user"} is banned and can't sign up again with the same email or device.`, reporterNotice] },
  REMOVE_GROUP: { title: "Remove this group", confirmLabel: "Remove group", isDestructive: true, requiresStepUp: true, permission: "chat-reports:review", consequences: () => ["The group is closed for every member. Members keep their own copies of earlier messages.", reporterNotice] },
  ESCALATE_LEGAL: { title: "Escalate to legal", confirmLabel: "Escalate to legal", isDestructive: false, requiresStepUp: true, permission: "chat-reports:legal", consequences: () => ["The submitted evidence is marked LEGAL REVIEW and held for the legal period.", "The reporter is told nothing until legal closes the case."] },
};

export function ChatReportActionDialog({ report, action, onClose, onCompleted }: { readonly report: ChatReportDetail; readonly action: ChatReportAction | null; readonly onClose: () => void; readonly onCompleted: (updated: ChatReportDetail, action: ChatReportAction) => void }) {
  const [suspensionDays, setSuspensionDays] = useState("7");
  const mutation = useAdminMutation((input: { action: ChatReportAction; reason: string }) =>
    applyActionToChatReport(report.id, { ...input, durationDays: input.action === "SUSPEND_USER" ? Number(suspensionDays) : undefined }),
  );
  if (!action) return null;
  const presentation = chatReportActionPresentations[action];

  async function confirmAction(reason: string) {
    if (!action) return;
    const updated = await mutation.run({ action, reason });
    if (updated) onCompleted(updated, action);
  }

  return (
    <ConfirmActionDialog intent="report"
      isOpen
      title={presentation.title}
      consequences={presentation.consequences(report)}
      confirmLabel={presentation.confirmLabel}
      tone={presentation.isDestructive ? "danger" : "default"}
      requiresStepUp={presentation.requiresStepUp}
      isBusy={mutation.isRunning}
      errorMessage={mutation.errorMessage}
      onConfirm={confirmAction}
      onClose={() => {
        mutation.clearError();
        onClose();
      }}
    >
      {action === "SUSPEND_USER" ? <SelectField label="Suspension length" value={suspensionDays} onChange={(event) => setSuspensionDays(event.target.value)} options={suspensionDurationOptions} /> : null}
    </ConfirmActionDialog>
  );
}
