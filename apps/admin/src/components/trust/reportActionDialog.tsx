"use client";

import { useState } from "react";

import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { SelectField } from "@/components/ui/formFields";
import { suspensionDurationOptions } from "@/constants/trustOptions.constant";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { applyContentActionToReport, revokeReportedAuthorVerification, suspendReportedAuthor } from "@/services/trustApi.service";
import type { ModerationAction, ReportDetail } from "@/types/moderation.type";

interface ActionPresentation {
  readonly title: string;
  readonly confirmLabel: string;
  readonly isDestructive: boolean;
  readonly requiresStepUp: boolean;
  readonly consequences: (report: ReportDetail) => string[];
}

export const reportActionPresentations: Record<ModerationAction, ActionPresentation> = {
  DISMISS: { title: "Dismiss this report", confirmLabel: "Dismiss report", isDestructive: false, requiresStepUp: false, consequences: () => ["The content stays up.", "Reporters are told no violation was found."] },
  HIDE: { title: "Hide this content", confirmLabel: "Hide content", isDestructive: false, requiresStepUp: false, consequences: () => ["Only the author can still see it.", "No strike is added."] },
  RESTRICT: { title: "Restrict this content", confirmLabel: "Restrict content", isDestructive: false, requiresStepUp: false, consequences: () => ["Removed from feeds, search and recommendations.", "Still reachable by direct link, with a sensitive-content screen."] },
  REMOVE: { title: "Remove this content", confirmLabel: "Remove content", isDestructive: true, requiresStepUp: false, consequences: (report) => ["The content is taken down for everyone.", `@${report.author.username} gets a strike (${report.author.strikeCount} to ${report.author.strikeCount + 1}) and can appeal.`] },
  WARN_AUTHOR: { title: "Warn the author", confirmLabel: "Send warning", isDestructive: false, requiresStepUp: false, consequences: (report) => [`@${report.author.username} receives a warning notification with your reason.`, `A strike is added (${report.author.strikeCount} to ${report.author.strikeCount + 1}).`] },
  SUSPEND_AUTHOR: { title: "Suspend the author", confirmLabel: "Suspend author", isDestructive: true, requiresStepUp: true, consequences: (report) => [`@${report.author.username} is signed out and can't post, sell, go live or withdraw during the suspension.`, "The reported content is hidden.", "Open orders keep running through escrow."] },
  REVOKE_AUTHOR_VERIFICATION: { title: "Revoke the author's verification", confirmLabel: "Revoke verification", isDestructive: true, requiresStepUp: true, consequences: (report) => [`@${report.author.username} loses the ${report.author.verification?.color.toLowerCase() ?? ""} badge and its perks immediately.`, "Revocation is permanent; they must apply again from scratch."] },
};

export function ReportActionDialog({ report, action, onClose, onCompleted }: { readonly report: ReportDetail; readonly action: ModerationAction | null; readonly onClose: () => void; readonly onCompleted: (updated: ReportDetail, action: ModerationAction) => void }) {
  const [suspensionDays, setSuspensionDays] = useState("7");
  const mutation = useAdminMutation(async (input: { action: ModerationAction; reason: string }) => {
    if (input.action === "SUSPEND_AUTHOR") return suspendReportedAuthor(report.id, Number(suspensionDays), input.reason);
    if (input.action === "REVOKE_AUTHOR_VERIFICATION") return revokeReportedAuthorVerification(report.id, input.reason);
    return applyContentActionToReport(report.id, input.action, input.reason);
  });
  if (!action) return null;
  const presentation = reportActionPresentations[action];

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
      {action === "SUSPEND_AUTHOR" ? <SelectField label="Suspension length" value={suspensionDays} onChange={(event) => setSuspensionDays(event.target.value)} options={suspensionDurationOptions} /> : null}
    </ConfirmActionDialog>
  );
}
