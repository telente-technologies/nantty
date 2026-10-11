"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { CheckboxField, SelectField, TextField } from "@/components/ui/formFields";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { banPlatformUser, deletePlatformUser, reinstatePlatformUser, restrictPlatformUser, suspendPlatformUser, unbanPlatformUser, warnPlatformUser } from "@/services/peopleApi.service";
import type { UserDetail } from "@/types/peopleUsers.type";

import styles from "./peopleWorkspace.module.css";

type ModerationAction = "warn" | "restrict" | "suspend" | "reinstate" | "ban" | "unban" | "delete";

const featureOptions = ["POSTING", "COMMENTING", "MESSAGING", "SELLING", "GOING_LIVE"];

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
  restrict: { title: "Restrict user", confirmLabel: "Restrict features", toast: "Features restricted", consequences: ["Only the chosen features are limited, for the chosen time.", "The user gets a notice with your reason. Everything else keeps working."], isDangerous: false, requiresStepUp: false },
  delete: { title: "Delete user", confirmLabel: "Delete account", toast: "Account deleted", consequences: ["The profile, posts, media and messages are deleted now.", "Order and payment records are anonymised and kept for the legal period (7 years).", "This cannot be undone."], isDangerous: true, requiresStepUp: true },
  reinstate: { title: "Reinstate user", confirmLabel: "Reinstate", toast: "User reinstated", consequences: ["Removes the suspension or warning status now."], isDangerous: false, requiresStepUp: false },
  ban: { title: "Ban user", confirmLabel: "Ban user", toast: "User banned", consequences: ["The account is closed and signed out everywhere.", "A permanent ban also blocks sign-up again with the same email and device.", "Their posts, clips and listings are hidden.", "Wallet funds are frozen pending finance review."], isDangerous: true, requiresStepUp: true },
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
  const [restrictedFeatures, setRestrictedFeatures] = useState<string[]>(["POSTING"]);
  const [restrictDays, setRestrictDays] = useState("7");
  const { user } = detail;

  const moderationMutation = useAdminMutation(async ({ action, reason }: { action: ModerationAction; reason: string }) => {
    if (action === "warn") return warnPlatformUser(user.id, { reason, policy, addStrike: shouldAddStrike });
    if (action === "restrict") return restrictPlatformUser(user.id, { reason, features: restrictedFeatures, durationDays: Number(restrictDays) });
    if (action === "delete") return deletePlatformUser(user.id, { reason, confirmUsername: user.username });
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
  const canRestrict = can("users:restrict");
  const canSuspend = can("users:suspend");
  const canDelete = can("users:delete");
  const isDeleted = user.status === "DELETED";
  const canBan = can("users:ban");
  const copy = activeAction ? actionCopy[activeAction] : null;

  return (
    <div className={styles.actionBar}>
      {canModerate && !isBanned && !isDeleted ? <Button size="small" onClick={() => openAction("warn")}>Warn</Button> : null}
      {canRestrict && !isBanned && !isDeleted ? <Button size="small" onClick={() => openAction("restrict")}>Restrict</Button> : null}
      {canSuspend && (user.status === "SUSPENDED" || user.status === "WARNED") ? <Button size="small" onClick={() => openAction("reinstate")}>Reinstate</Button> : null}
      {canSuspend && !isBanned && !isDeleted && user.status !== "SUSPENDED" ? <Button size="small" variant="quietDanger" onClick={() => openAction("suspend")}>Suspend</Button> : null}
      {canBan && !isBanned && !isDeleted ? <Button size="small" variant="danger" iconName="shield24" onClick={() => openAction("ban")}>Ban</Button> : null}
      {canDelete && !isDeleted ? <Button size="small" variant="danger" iconName="shield24" onClick={() => openAction("delete")}>Delete</Button> : null}
      {canBan && isBanned ? <Button size="small" iconName="shield24" onClick={() => openAction("unban")}>Unban</Button> : null}
      {copy && activeAction ? (
        <ConfirmActionDialog intent="moderation"
          isOpen
          title={`${copy.title} @${user.username}`}
          consequences={copy.consequences}
          confirmLabel={copy.confirmLabel}
          tone={copy.isDangerous ? "danger" : "default"}
          requiresStepUp={copy.requiresStepUp}
          typedConfirmationText={activeAction === "ban" || activeAction === "delete" ? user.username : undefined}
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
          {activeAction === "restrict" ? (
            <>
              {featureOptions.map((feature) => <CheckboxField key={feature} label={feature.charAt(0) + feature.slice(1).toLowerCase().replace("_", " ")} checked={restrictedFeatures.includes(feature)} onChange={(event) => setRestrictedFeatures(event.target.checked ? [...restrictedFeatures, feature] : restrictedFeatures.filter((item) => item !== feature))} />)}
              <SelectField label="Restrict for" options={[{ value: "1", label: "1 day" }, { value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} value={restrictDays} onChange={(event) => setRestrictDays(event.target.value)} />
            </>
          ) : null}
          {activeAction === "ban" ? <SelectField label="Ban duration" options={banDurationOptions} value={banDuration} onChange={(event) => setBanDuration(event.target.value)} /> : null}
        </ConfirmActionDialog>
      ) : null}
    </div>
  );
}
