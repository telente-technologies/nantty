"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import styles from "@/components/actions/actionDialogs.module.css";
import { Button } from "@/components/ui/button";
import { FlagIcon } from "@/components/ui/icons";
import { ModalDialog } from "@/components/ui/modalDialog";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { liveSafetyService } from "@/services/liveSafety.service";
import type { LiveReportReason } from "@/types";

import safetyStyles from "./liveSafety.module.css";

const liveReportReasons: readonly { readonly value: LiveReportReason; readonly label: string; readonly isUrgent?: boolean }[] = [
  { value: "child_safety", label: "Child safety", isUrgent: true },
  { value: "self_harm", label: "Self-harm or suicide", isUrgent: true },
  { value: "violence", label: "Violence or dangerous acts", isUrgent: true },
  { value: "sexual_content", label: "Nudity or sexual content" },
  { value: "hate", label: "Hate" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "scam", label: "Scam or fraud" },
  { value: "intellectual_property", label: "Copyright or intellectual property" },
  { value: "other", label: "Something else" },
];

const REPORT_COOLDOWN_MS = 60_000;
const lastReportAtByLiveId = new Map<string, number>();

export const SELF_HARM_SUPPORT_TEXT =
  "You're not alone. If you or someone on this live is in immediate danger, contact your local emergency number now. Free, confidential helplines are listed at findahelpline.com.";

export function formatMomentIntoLive(offsetSeconds: number): string {
  const whole = Math.max(0, Math.floor(offsetSeconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = String(whole % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

interface LiveReportDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly liveId: string;
  readonly startedAt: string | null | undefined;
}

export function LiveReportDialog({ isOpen, onClose, liveId, startedAt }: LiveReportDialogProps) {
  const [reason, setReason] = useState<LiveReportReason | "">("");
  const [details, setDetails] = useState("");
  const [reportedAt] = useState(() => new Date());
  const startedAtMs = startedAt ? Date.parse(startedAt) : Number.NaN;
  const offsetSeconds = Number.isFinite(startedAtMs) ? Math.max(0, Math.round((reportedAt.getTime() - startedAtMs) / 1000)) : undefined;
  const lastReportAt = lastReportAtByLiveId.get(liveId);
  const cooldownSeconds = lastReportAt === undefined ? 0 : Math.ceil(Math.max(0, REPORT_COOLDOWN_MS - (Date.now() - lastReportAt)) / 1000);
  const selected = liveReportReasons.find((option) => option.value === reason);

  const reportMutation = useMutation({
    mutationFn: () => {
      const capturedAt = new Date().toISOString();
      return liveSafetyService.reportLive(liveId, reason as LiveReportReason, details.trim(), {
        capturedAt, frameRef: `live:${liveId}@${capturedAt}`, ...(offsetSeconds === undefined ? {} : { offsetSeconds }),
      });
    },
    onSuccess: () => {
      lastReportAtByLiveId.set(liveId, Date.now());
      showToast({ text: selected?.isUrgent ? "Report sent. Our safety team is looking at this live now." : "Report sent. Thanks for helping keep Zudomart safe." });
      setReason("");
      setDetails("");
      onClose();
    },
  });

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Report this live"
      description="Reports are anonymous. The host won't know it was you."
      icon={<FlagIcon size={24} />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => reportMutation.mutate()} disabled={!reason || cooldownSeconds > 0} busy={reportMutation.isPending}>
            Send report
          </Button>
        </>
      }
    >
      <fieldset className={styles.optionList}>
        <legend className="visuallyHidden">What is happening on this live?</legend>
        {liveReportReasons.map((option) => (
          <label key={option.value} className={styles.option}>
            <input type="radio" name="live-report-reason" value={option.value} checked={reason === option.value} onChange={() => setReason(option.value)} />
            <span className={styles.optionTitle}>{option.label}</span>
            {option.isUrgent ? <span className={safetyStyles.urgentTag}>Urgent</span> : null}
          </label>
        ))}
      </fieldset>
      {reason === "self_harm" ? (
        <p className={safetyStyles.supportNotice} role="note">
          {SELF_HARM_SUPPORT_TEXT}
        </p>
      ) : null}
      <label className={styles.label} htmlFor="live-report-details">
        Anything else we should know? (optional)
      </label>
      <textarea id="live-report-details" className={styles.textarea} maxLength={500} value={details} onChange={(event) => setDetails(event.target.value)} />
      <p className={safetyStyles.contextNote}>
        {offsetSeconds === undefined
          ? "We'll attach the moment you reported and a still from the stream."
          : `We'll attach the moment you reported (${formatMomentIntoLive(offsetSeconds)} into the live) and a still from the stream.`}
      </p>
      {cooldownSeconds > 0 ? <p className={safetyStyles.contextNote}>You reported this live a moment ago. You can send another report in {cooldownSeconds} seconds.</p> : null}
      {reportMutation.isError ? (
        <p className={styles.error} role="alert">
          {readErrorMessageForDisplay(reportMutation.error)}
        </p>
      ) : null}
    </ModalDialog>
  );
}
