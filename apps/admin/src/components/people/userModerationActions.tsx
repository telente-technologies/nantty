"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { CheckboxField, SelectField, TextField } from "@/components/ui/formFields";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { banPlatformUser, reinstatePlatformUser, suspendPlatformUser, unbanPlatformUser, warnPlatformUser } from "@/services/peopleApi.service";
import type { UserDetail } from "@/types/peopleUsers.type";

import styles from "./peopleWorkspace.module.css";

type ModerationAction = "warn" | "suspend" | "reinstate" | "ban" | "unban";

const suspensionDurationOptions = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
];

const banDurationOptions = [
  { value: "PERMANENT", label: "Permanent" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
];

const actionCopy: Record<ModerationAction, { title: string; confirmLabel: string; toast: string; consequences: string[]; isDangerous: boolean; requiresStepUp: boolean }> = {
  warn: { title: "Warn user", confirmLabel: "Send warning", toast: "Warning sent", consequences: ["The user gets an in-app warning with your reason.", "Status changes to Warned."], isDangerous: false, requiresStepUp: false },
  suspend: { title: "Suspend user", confirmLabel: "Suspend", toast: "User suspended", consequences: ["The user is signed out everywhere and can't post, sell, go live or message.", "Orders in escrow continue; payouts are held.", "The suspension lifts automatically at the end of the period."], isDangerous: true, requiresStepUp: false },
  reinstate: { title: "Reinstate user", confirmLabel: "Reinstate", toast: "User reinstated", consequences: ["Removes the suspension or warning status now."], isDangerous: false, requiresStepUp: false },
  ban: { title: "Ban user", confirmLabel: "Ban user", toast: "User banned", consequences: ["The account is closed and signed out everywhere.", "Their posts, clips and listings are hidden.", "Wallet funds are frozen pending finance review."], isDangerous: true, requiresStepUp: true },
  unban: { title: "Unban user", confirmLabel: "Unban user", toast: "User unbanned", consequences: ["The account is restored. Hidden content stays hidden until reviewed."], isDangerous: false, requiresStepUp: true },
};

export function UserModerationActions({ detail, onUpdated }: { readonly detail: UserDetail; readonly onUpdated: (detail: UserDetail) => void }) {
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const [activeAction, setActiveAction] = useState<ModerationAction | null>(null);
  const [policy, setPolicy] = useState("Community guidelines");
  const [shouldAddStrike, setShouldAddStrike] = useState(false);
  const [suspensionDays, setSuspensionDays] = useState("7");
  const [banDuration, setBanDuration] = useState("PERMANENT");
  const { user } = detail;

  const moderationMutation = useAdminMutation(async ({ action, reason }: { action: ModerationAction; reason: string }) => {
    if (action === "warn") return warnPlatformUser(user.id, { reason, policy, addStrike: shouldAddStrike });
    if (action === "suspend") return suspendPlatformUser(user.id, { reason, durationDays: Number(suspensionDays) });
    if (action === "reinstate") return reinstatePlatformUser(user.id, reason);
    if (action === "ban") return banPlatformUser(user.id, { reason, durationDays: banDuration === "PERMANENT" ? null : Number(banDuration) });
    return unbanPlatformUser(user.id, reason);
  });

  function openAction(action: ModerationAction) {
    moderationMutation.clearError();
    setActiveAction(action);
  }

  async function confirmAction(reason: string) {
    if (!activeAction) return;
    const updated = await moderationMutation.run({ action: activeAction, reason });
    if (!updated) return;
    onUpdated(updated);
    showToast(actionCopy[activeAction].toast);
    setActiveAction(null);
  }

  const isBanned = user.status === "BANNED";
  const canModerate = can("users:moderate");
  const canBan = can("users:ban");
  const copy = activeAction ? actionCopy[activeAction] : null;

  return (
    <div className={styles.actionBar}>
      {canModerate && !isBanned ? <Button size="small" onClick={() => openAction("warn")}>Warn</Button> : null}
      {canModerate && (user.status === "SUSPENDED" || user.status === "WARNED") ? <Button size="small" onClick={() => openAction("reinstate")}>Reinstate</Button> : null}
      {canModerate && !isBanned && user.status !== "SUSPENDED" ? <Button size="small" variant="quietDanger" onClick={() => openAction("suspend")}>Suspend</Button> : null}
      {canBan && !isBanned ? <Button size="small" variant="danger" iconName="shield24" onClick={() => openAction("ban")}>Ban</Button> : null}
      {canBan && isBanned ? <Button size="small" iconName="shield24" onClick={() => openAction("unban")}>Unban</Button> : null}
      {copy && activeAction ? (
        <ConfirmActionDialog
          isOpen
          title={`${copy.title} @${user.username}`}
          consequences={copy.consequences}
          confirmLabel={copy.confirmLabel}
          tone={copy.isDangerous ? "danger" : "default"}
          requiresStepUp={copy.requiresStepUp}
          typedConfirmationText={activeAction === "ban" ? user.username : undefined}
          isBusy={moderationMutation.isRunning}
          errorMessage={moderationMutation.errorMessage}
          onConfirm={confirmAction}
          onClose={() => setActiveAction(null)}
        >
          {activeAction === "warn" ? (
            <>
              <TextField label="Policy" value={policy} onChange={(event) => setPolicy(event.target.value)} maxLength={80} />
              <CheckboxField label="Also add a strike" description="Strikes expire after 90 days. Three active strikes restrict selling and going live." checked={shouldAddStrike} onChange={(event) => setShouldAddStrike(event.target.checked)} />
            </>
          ) : null}
          {activeAction === "suspend" ? <SelectField label="Suspend for" options={suspensionDurationOptions} value={suspensionDays} onChange={(event) => setSuspensionDays(event.target.value)} /> : null}
          {activeAction === "ban" ? <SelectField label="Ban duration" options={banDurationOptions} value={banDuration} onChange={(event) => setBanDuration(event.target.value)} /> : null}
        </ConfirmActionDialog>
      ) : null}
    </div>
  );
}
