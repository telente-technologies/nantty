"use client";

import { useState } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";
import { OverlayDialog } from "@/components/ui/overlayDialog";
import { useToast } from "@/components/ui/toastProvider";
import { campaignsApi } from "@/services/campaignsApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { BulkAction, BulkActionResult } from "@/types/campaign.type";

import styles from "./campaignsPage.module.css";

export type BulkLevel = "campaign" | "ad_set" | "ad";

const levelNouns: Record<BulkLevel, string> = { campaign: "campaign", ad_set: "ad set", ad: "ad" };
const actionPastTense: Record<BulkAction, string> = { pause: "Paused", resume: "Resumed", archive: "Archived", duplicate: "Duplicated", submit_for_review: "Sent for review" };

function describeBulkActionResult(action: BulkAction, level: BulkLevel, result: BulkActionResult): { text: string; isError: boolean } {
  const noun = levelNouns[level];
  const succeeded = result.succeededIds.length;
  const successText = succeeded > 0 ? `${actionPastTense[action]} ${succeeded} ${noun}${succeeded === 1 ? "" : "s"}.` : "";
  if (result.failed.length === 0) return { text: successText, isError: false };
  const reasons = [...new Set(result.failed.map((failure) => failure.message))].join(" ");
  return { text: `${successText} ${result.failed.length} skipped: ${reasons}`.trim(), isError: true };
}

interface BulkActionBarProps {
  readonly level: BulkLevel;
  readonly selectedIds: ReadonlySet<string>;
  readonly onClearSelection: () => void;
  readonly onActionApplied: () => void;
}

export function BulkActionBar({ level, selectedIds, onClearSelection, onActionApplied }: BulkActionBarProps) {
  const { accountId } = useAdAccount();
  const { showToast } = useToast();
  const [runningAction, setRunningAction] = useState<BulkAction | null>(null);
  const [isArchiveConfirmationOpen, setIsArchiveConfirmationOpen] = useState(false);
  const selectedCount = selectedIds.size;
  if (selectedCount === 0) return null;

  async function applyBulkActionToSelection(action: BulkAction) {
    setRunningAction(action);
    try {
      const result = await campaignsApi.applyBulkAction(accountId, level, [...selectedIds], action);
      const message = describeBulkActionResult(action, level, result);
      showToast(message.text, message.isError ? "error" : "success");
      onClearSelection();
      onActionApplied();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setRunningAction(null);
      setIsArchiveConfirmationOpen(false);
    }
  }

  const noun = `${levelNouns[level]}${selectedCount === 1 ? "" : "s"}`;
  return (
    <div className={styles.bulkBar} role="toolbar" aria-label={`Actions for ${selectedCount} selected ${noun}`}>
      <span className={styles.bulkCount}>
        {selectedCount} {noun} selected
      </span>
      <Button size="small" isLoading={runningAction === "pause"} onClick={() => applyBulkActionToSelection("pause")}>
        Pause
      </Button>
      <Button size="small" isLoading={runningAction === "resume"} onClick={() => applyBulkActionToSelection("resume")}>
        Resume
      </Button>
      <Button size="small" iconName="copy16" isLoading={runningAction === "duplicate"} onClick={() => applyBulkActionToSelection("duplicate")}>
        Duplicate
      </Button>
      <Button size="small" iconName="paperPlaneTilt24" isLoading={runningAction === "submit_for_review"} onClick={() => applyBulkActionToSelection("submit_for_review")}>
        Send for review
      </Button>
      <Button size="small" variant="danger" onClick={() => setIsArchiveConfirmationOpen(true)}>
        Archive
      </Button>
      <Button size="small" variant="ghost" onClick={onClearSelection}>
        Clear
      </Button>
      <OverlayDialog intent="archive"
        isOpen={isArchiveConfirmationOpen}
        onClose={() => setIsArchiveConfirmationOpen(false)}
        title={`Archive ${selectedCount} ${noun}?`}
        description="Archived items stop delivering for good and move to Completed. Reports keep their results."
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsArchiveConfirmationOpen(false)}>
              Keep them
            </Button>
            <Button variant="danger" isLoading={runningAction === "archive"} onClick={() => applyBulkActionToSelection("archive")}>
              Archive
            </Button>
          </>
        }
      >
        <p>You can duplicate an archived {levelNouns[level]} later if you want to run it again.</p>
      </OverlayDialog>
    </div>
  );
}
