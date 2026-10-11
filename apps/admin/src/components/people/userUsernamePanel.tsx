"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { EmptyState, NoticeBanner } from "@/components/ui/feedback";
import { CheckboxField, SelectField, TextField } from "@/components/ui/formFields";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, KeyValueList } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { assignHeldUsername, fetchUsernameHold, reassignPlatformUsername, reclaimWithheldUsername, withholdPlatformUsername } from "@/services/peopleApi.service";
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
  const { can } = useAdminPermissions();
  const [isWithholdOpen, setIsWithholdOpen] = useState(false);
  const [isReclaimOpen, setIsReclaimOpen] = useState(false);
  const [reclaimMode, setReclaimMode] = useState<ReclaimMode>("RESTORE_TO_OWNER");
  const [claimantUserId, setClaimantUserId] = useState("");
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [isAssignHeldOpen, setIsAssignHeldOpen] = useState(false);
  const [heldCandidate, setHeldCandidate] = useState("");
  const [bypassHold, setBypassHold] = useState(false);
  const [recipientUserId, setRecipientUserId] = useState("");
  const [lastWithholdResult, setLastWithholdResult] = useState<UsernameWithholdResult | null>(null);
  const withholdMutation = useAdminMutation((reason: string) => withholdPlatformUsername(detail.user.id, reason));
  const reclaimMutation = useAdminMutation((reason: string) => reclaimWithheldUsername(detail.user.id, { reason, mode: reclaimMode, claimantUserId: reclaimMode === "ASSIGN_TO_CLAIMANT" ? claimantUserId.trim() : undefined }));

  const reassignMutation = useAdminMutation((reason: string) => reassignPlatformUsername(detail.user.id, { reason, recipientUserId: recipientUserId.trim() }));

  const holdLookup = useAdminQuery((signal) => fetchUsernameHold(heldCandidate.trim(), signal), heldCandidate.trim(), isAssignHeldOpen && heldCandidate.trim().length >= 3);
  const assignHeldMutation = useAdminMutation((reason: string) => assignHeldUsername(detail.user.id, { username: heldCandidate.trim(), reason, bypassHold }));
  const hold = holdLookup.data;
  const isInHold = hold?.isHeld === true;

  async function assignHeld(reason: string) {
    const updated = await assignHeldMutation.run(reason);
    if (!updated) return;
    onUpdated(updated);
    showToast(isInHold ? "Username assigned. Hold bypassed and flagged in the audit log." : "Username assigned.");
    setIsAssignHeldOpen(false);
    setHeldCandidate("");
    setBypassHold(false);
  }

  async function reassignUsername(reason: string) {
    const updated = await reassignMutation.run(reason);
    if (!updated) return;
    onUpdated(updated);
    showToast(`Username moved. @${updated.user.username} now uses an auto-generated name, and both people were notified.`);
    setIsReassignOpen(false);
    setRecipientUserId("");
  }

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
          <>
            {can("usernames:reassign") ? <Button size="small" onClick={() => setIsAssignHeldOpen(true)}>Assign a held username</Button> : null}
            {can("usernames:reassign") ? <Button size="small" variant="quietDanger" iconName="shield24" onClick={() => setIsReassignOpen(true)}>Reassign @{detail.user.username}</Button> : null}
          {canManageUsernames ? (
            withheld ? (
              <Button size="small" iconName="shield24" onClick={() => setIsReclaimOpen(true)}>Reclaim @{withheld.username}</Button>
            ) : (
              <Button size="small" variant="quietDanger" iconName="shield24" onClick={() => setIsWithholdOpen(true)}>Withhold @{detail.user.username}</Button>
            )
          ) : null}
          </>
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
      {isAssignHeldOpen ? (
        <ConfirmActionDialog intent="edit" isOpen title={`Assign a username to @${detail.user.username}`} consequences={["Their current username is held for 120 days before anyone else can claim it.", "The person is notified and the username history is kept."]} confirmLabel={isInHold ? "Assign and bypass hold" : "Assign username"} tone={isInHold ? "danger" : "default"} requiresStepUp isConfirmDisabled={heldCandidate.trim().length < 3 || (isInHold && !bypassHold)} isBusy={assignHeldMutation.isRunning} errorMessage={assignHeldMutation.errorMessage} onConfirm={assignHeld} onClose={() => { assignHeldMutation.clearError(); setIsAssignHeldOpen(false); }}>
          <TextField label="Username to assign" value={heldCandidate} onChange={(event) => { setHeldCandidate(event.target.value.toLowerCase().replace(/^@/, "")); setBypassHold(false); }} autoComplete="off" />
          {hold && hold.releasedAt ? <NoticeBanner tone={isInHold ? "caution" : "info"} title={isInHold ? "In its 120-day hold" : "Hold has ended"}>{isInHold ? `Released ${formatDateTime(hold.releasedAt)}, available ${formatDateTime(hold.availableAt)}.` : `Available since ${formatDateTime(hold.availableAt)}.`}</NoticeBanner> : null}
          {isInHold ? <CheckboxField label="Assign it anyway (hold bypassed)" description="Needs a reason and is flagged in the audit log." checked={bypassHold} onChange={(event) => setBypassHold(event.target.checked)} /> : null}
        </ConfirmActionDialog>
      ) : null}
      {isReassignOpen ? (
        <ConfirmActionDialog intent="transfer" isOpen title={`Move @${detail.user.username} to another account`} consequences={["The other account takes this username and its earlier username is released.", "This account gets an auto-generated username and a notification.", "Both accounts keep the username history. Use this for verified brand claims."]} confirmLabel="Reassign username" tone="danger" requiresStepUp isConfirmDisabled={recipientUserId.trim().length < 4} isBusy={reassignMutation.isRunning} errorMessage={reassignMutation.errorMessage} onConfirm={reassignUsername} onClose={() => { reassignMutation.clearError(); setIsReassignOpen(false); }}>
          <TextField label="Receiving account ID" placeholder="usr_0001" value={recipientUserId} onChange={(event) => setRecipientUserId(event.target.value)} autoComplete="off" />
        </ConfirmActionDialog>
      ) : null}
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
                  <span className="mono">@{entry.fromUsername} to @{entry.toUsername}</span> <StatusBadge label={humanizeConstantName(entry.kind)} tone={entry.kind === "USER_CHANGE" ? "neutral" : "night"} hasDot={false} />
                  {entry.reason ? <><br /><span className={styles.muted}>{entry.reason}</span></> : null}
                </span>
                <span className={styles.faint}>{formatDateTime(entry.changedAt)} · {entry.changedByName}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmActionDialog intent="lock"
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
        <ConfirmActionDialog intent="restore"
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
