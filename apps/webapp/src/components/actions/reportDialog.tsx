"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modalDialog";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { reportsService, type ReportTargetType } from "@/services/webActions.service";
import { CopyrightClaimDialog } from "@/components/copyright/copyrightClaimDialog";

import styles from "./actionDialogs.module.css";

const reportReasons = [
  { value: "spam", label: "Spam or misleading" },
  { value: "scam", label: "Scam or fraud" },
  { value: "prohibited_items", label: "Counterfeit or fake product" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate speech or symbols" },
  { value: "sexual_content", label: "Nudity or sexual content" },
  { value: "violence", label: "Violence or dangerous acts" },
  { value: "intellectual_property", label: "Copyright or trademark" },
  { value: "other", label: "Something else" },
] as const;

const targetNames: Record<ReportTargetType, string> = { post: "post", clip: "clip", comment: "comment", live: "live", user: "account", product: "product", message: "message" };

interface ReportDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly targetType: ReportTargetType;
  readonly targetId: string;
}

const copyrightClaimTargets = new Set<ReportTargetType>(["post", "clip", "live"]);

export function ReportDialog({ isOpen, onClose, targetType, targetId }: ReportDialogProps) {
  const [reason, setReason] = useState<string>("");
  const [isClaimOpen, setIsClaimOpen] = useState(false);
  const routesToCopyrightClaim = reason === "intellectual_property" && copyrightClaimTargets.has(targetType);
  const [details, setDetails] = useState("");
  const reportMutation = useMutation({
    mutationFn: () => reportsService.submitReport(targetType, targetId, reason, details.trim()),
    onSuccess: () => {
      showToast({ text: "Report sent. Thanks for helping keep Zudomart safe." });
      setReason("");
      setDetails("");
      onClose();
    },
  });

  if (isClaimOpen) {
    return <CopyrightClaimDialog isOpen={isOpen} onClose={() => { setIsClaimOpen(false); setReason(""); onClose(); }} targetType={targetType as "post" | "clip" | "live"} targetId={targetId} />;
  }

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Report this ${targetNames[targetType]}`}
      description="Reports are anonymous. The person you report won't know it was you."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {routesToCopyrightClaim ? (
            <Button onClick={() => setIsClaimOpen(true)}>Continue to copyright claim</Button>
          ) : (
            <Button onClick={() => reportMutation.mutate()} disabled={!reason} busy={reportMutation.isPending}>
              Send report
            </Button>
          )}
        </>
      }
    >
      <fieldset className={styles.optionList}>
        <legend className="visuallyHidden">Why are you reporting this?</legend>
        {reportReasons.map((option) => (
          <label key={option.value} className={styles.option}>
            <input type="radio" name="report-reason" value={option.value} checked={reason === option.value} onChange={() => setReason(option.value)} />
            <span className={styles.optionTitle}>{option.label}</span>
          </label>
        ))}
      </fieldset>
      <label className={styles.label} htmlFor="report-details">
        Anything else we should know? (optional)
      </label>
      <textarea id="report-details" className={styles.textarea} maxLength={500} value={details} onChange={(event) => setDetails(event.target.value)} />
      {reportMutation.isError ? (
        <p className={styles.error} role="alert">
          {readErrorMessageForDisplay(reportMutation.error)}
        </p>
      ) : null}
    </ModalDialog>
  );
}
