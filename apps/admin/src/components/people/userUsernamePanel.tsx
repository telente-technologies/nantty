"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { EmptyState, NoticeBanner } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, KeyValueList } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { reclaimWithheldUsername, withholdPlatformUsername } from "@/services/peopleApi.service";
import type { UserDetail, UsernameWithholdResult } from "@/types/peopleUsers.type";
import { formatDateTime, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./peopleWorkspace.module.css";

type ReclaimMode = "RESTORE_TO_OWNER" | "ASSIGN_TO_CLAIMANT";

interface UserUsernamePanelProps {
  readonly detail: UserDetail;
  readonly canManageUsernames: boolean;
  readonly onUpdated: (detail: UserDetail) => void;
  readonly onReload: () => void;
}

export function UserUsernamePanel({ detail, canManageUsernames, onUpdated, onReload }: UserUsernamePanelProps) {
  const { showToast } = useToast();
  const [isWithholdOpen, setIsWithholdOpen] = useState(false);
  const [isReclaimOpen, setIsReclaimOpen] = useState(false);
  const [reclaimMode, setReclaimMode] = useState<ReclaimMode>("RESTORE_TO_OWNER");
  const [claimantUserId, setClaimantUserId] = useState("");
  const [lastWithholdResult, setLastWithholdResult] = useState<UsernameWithholdResult | null>(null);
  const withholdMutation = useAdminMutation((reason: string) => withholdPlatformUsername(detail.user.id, reason));
  const reclaimMutation = useAdminMutation((reason: string) => reclaimWithheldUsername(detail.user.id, { reason, mode: reclaimMode, claimantUserId: reclaimMode === "ASSIGN_TO_CLAIMANT" ? claimantUserId.trim() : undefined }));

  async function withholdUsername(reason: string) {
    const result = await withholdMutation.run(reason);
    if (!result) return;
    setLastWithholdResult(result);
    setIsWithholdOpen(false);
    showToast(`@${result.withheldUsername.username} withheld · user is now @${result.assignedUsername}`);
    onReload();
  }

  async function reclaimUsername(reason: string) {
    const updated = await reclaimMutation.run(reason);
    if (!updated) return;
    onUpdated(updated);
    setIsReclaimOpen(false);
    setLastWithholdResult(null);
    showToast(reclaimMode === "RESTORE_TO_OWNER" ? "Username restored to the original owner" : "Username assigned to the claimant");
  }

  const withheld = detail.withheldUsername;
  return (
    <>
      <Card
        title="Username"
        actions={
          canManageUsernames ? (
            withheld ? (
              <Button size="small" iconName="shield24" onClick={() => setIsReclaimOpen(true)}>Reclaim @{withheld.username}</Button>
            ) : (
              <Button size="small" variant="quietDanger" iconName="shield24" onClick={() => setIsWithholdOpen(true)}>Withhold @{detail.user.username}</Button>
            )
          ) : null
        }
      >
        <KeyValueList
          columns={2}
          items={[
            { label: "Current username", value: `@${detail.user.username}`, isMono: true },
            { label: "Withheld username", value: withheld ? <><span className="mono">@{withheld.username}</span> <StatusBadge status="WITHHELD" /></> : "None" },
          ]}
        />
        {withheld ? <p className={styles.faint}>Withheld {formatDateTime(withheld.withheldAt)} by {withheld.withheldByName}: “{withheld.reason}”</p> : null}
      </Card>
      {lastWithholdResult ? (
        <NoticeBanner tone="success" title="Notification sent to the user">
          <strong>{lastWithholdResult.notification.title}</strong> — {lastWithholdResult.notification.body}
        </NoticeBanner>
      ) : null}
      <Card title="Username history">
        {detail.usernameHistory.length === 0 ? (
          <EmptyState title="No username changes" />
        ) : (
          <ul className={styles.list}>
            {detail.usernameHistory.map((entry) => (
              <li key={entry.id} className={styles.listItem}>
                <span>
                  <span className="mono">@{entry.fromUsername} → @{entry.toUsername}</span> <StatusBadge label={humanizeConstantName(entry.kind)} tone={entry.kind === "USER_CHANGE" ? "neutral" : "night"} hasDot={false} />
                  {entry.reason ? <><br /><span className={styles.muted}>{entry.reason}</span></> : null}
                </span>
                <span className={styles.faint}>{formatDateTime(entry.changedAt)} · {entry.changedByName}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmActionDialog
        isOpen={isWithholdOpen}
        title={`Withhold @${detail.user.username}`}
        consequences={["The user immediately gets an auto-generated username like @user_8k2m4q.", "They receive an in-app and email notification with your reason.", "Nobody can register the withheld username until it is restored or reassigned."]}
        confirmLabel="Withhold username"
        tone="danger"
        requiresStepUp
        reasonPlaceholder="e.g. Trademark complaint from the registered brand owner"
        isBusy={withholdMutation.isRunning}
        errorMessage={withholdMutation.errorMessage}
        onConfirm={withholdUsername}
        onClose={() => setIsWithholdOpen(false)}
      />
      {withheld ? (
        <ConfirmActionDialog
          isOpen={isReclaimOpen}
          title={`Reclaim @${withheld.username}`}
          confirmLabel={reclaimMode === "RESTORE_TO_OWNER" ? "Restore to owner" : "Assign to claimant"}
          requiresStepUp
          isConfirmDisabled={reclaimMode === "ASSIGN_TO_CLAIMANT" && !/^usr_[A-Za-z0-9]+$/.test(claimantUserId.trim())}
          isBusy={reclaimMutation.isRunning}
          errorMessage={reclaimMutation.errorMessage}
          onConfirm={reclaimUsername}
          onClose={() => setIsReclaimOpen(false)}
        >
          <SelectField label="What should happen" value={reclaimMode} onChange={(event) => setReclaimMode(event.target.value as ReclaimMode)} options={[{ value: "RESTORE_TO_OWNER", label: `Give it back to @${detail.user.username}` }, { value: "ASSIGN_TO_CLAIMANT", label: "Assign to a verified claimant" }]} />
          {reclaimMode === "ASSIGN_TO_CLAIMANT" ? <TextField label="Claimant user ID" hint="Only verified accounts can receive a reclaimed username." placeholder="usr_0010" value={claimantUserId} onChange={(event) => setClaimantUserId(event.target.value)} /> : null}
        </ConfirmActionDialog>
      ) : null}
    </>
  );
}
