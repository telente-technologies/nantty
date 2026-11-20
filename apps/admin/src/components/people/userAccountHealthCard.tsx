"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, KeyValueList } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { clearMonetisationOverride, decideStrikeAppeal, fetchAccountHealth, setMonetisationOverride } from "@/services/copyrightPolicyApi.service";
import type { AccountHealthStrike } from "@/types/accountHealth.type";
import { formatDateTime, humanizeConstantName } from "@/utils/formatting.util";

const standingTone = { GOOD_STANDING: "success", AT_RISK: "caution", RESTRICTED: "danger" } as const;

export function UserAccountHealthCard({ userId }: { readonly userId: string }) {
  const { data: health, reload } = useAdminQuery((signal) => fetchAccountHealth(userId, signal), `account-health-${userId}`);
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const [pending, setPending] = useState<{ strike: AccountHealthStrike; decision: "uphold" | "overturn" } | null>(null);
  const [pendingOverride, setPendingOverride] = useState<"ALLOW" | "PAUSE" | "CLEAR" | null>(null);
  const mutation = useAdminMutation((input: { strikeId: string; decision: "uphold" | "overturn"; reason: string }) => decideStrikeAppeal(input.strikeId, input.decision, input.reason));
  const overrideMutation = useAdminMutation((input: { action: "ALLOW" | "PAUSE" | "CLEAR"; reason: string }) =>
    input.action === "CLEAR" ? clearMonetisationOverride(userId, input.reason) : setMonetisationOverride(userId, input.action, input.reason),
  );
  if (!health) return null;
  const appealable = [...health.strikes, ...health.warnings].filter((strike) => strike.appealStatus === "PENDING");
  const canOverrideMonetisation = can("users:suspend") || can("moderation:appeals");

  async function confirmAppealDecision(reason: string) {
    if (!pending) return;
    if (!(await mutation.run({ strikeId: pending.strike.id, decision: pending.decision, reason }))) return;
    showToast(pending.decision === "overturn" ? "Appeal overturned. The strike was removed." : "Appeal upheld. The strike stays.");
    setPending(null);
    reload();
  }

  async function confirmMonetisationOverride(reason: string) {
    if (!pendingOverride) return;
    if (!(await overrideMutation.run({ action: pendingOverride, reason }))) return;
    showToast(pendingOverride === "CLEAR" ? "Monetisation override cleared." : `Monetisation override set to ${pendingOverride.toLowerCase()}.`);
    setPendingOverride(null);
    reload();
  }

  return (
    <Card title="Account health" actions={<StatusBadge label={humanizeConstantName(health.status)} tone={standingTone[health.status]} />}>
      <KeyValueList columns={3} items={[
        { label: "Active strikes", value: `${health.activeStrikeCount} of ${health.restrictionThreshold}` },
        { label: `Copyright strikes (${health.strikeWindowDays} days)`, value: String(health.copyrightStrikesInWindow) },
        { label: "Pending takedown deadlines", value: String(health.pendingTakedownCount) },
        { label: "Restrictions", value: health.restrictions.length ? health.restrictions.map(humanizeConstantName).join(", ") : "None" },
        { label: "Monetisation", value: health.canMonetise ? "Allowed" : "Paused" },
        { label: "Suspension review", value: health.needsSuspensionReview ? "Due" : "Not needed" },
      ]} />
      {health.monetisationOverride ? (
        <p>Monetisation override: <strong>{health.monetisationOverride.mode}</strong> by {health.monetisationOverride.actorName} ({health.monetisationOverride.reason})</p>
      ) : null}
      {canOverrideMonetisation ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {!health.canMonetise ? (
            <Button size="small" variant="secondary" onClick={() => setPendingOverride("ALLOW")}>Override: Allow monetisation</Button>
          ) : (
            <Button size="small" variant="danger" onClick={() => setPendingOverride("PAUSE")}>Override: Pause monetisation</Button>
          )}
          {health.monetisationOverride ? (
            <Button size="small" variant="ghost" onClick={() => setPendingOverride("CLEAR")}>Clear override</Button>
          ) : null}
        </div>
      ) : null}
      {health.notices.length ? (
        <KeyValueList items={health.notices.map((notice) => ({ label: `${humanizeConstantName(notice.content.type)} ${notice.content.id}`, value: `${notice.workTitle} · ${humanizeConstantName(notice.state)}${notice.deadlineAt ? ` · deadline ${formatDateTime(notice.deadlineAt)}` : ""}` }))} />
      ) : null}
      {appealable.map((strike) => (
        <div key={strike.id}>
          <p>Appeal pending on {strike.policy} ({formatDateTime(strike.issuedAt)})</p>
          {can("moderation:appeals") || can("copyright:review") ? (
            <>
              <Button size="small" variant="secondary" onClick={() => setPending({ strike, decision: "uphold" })}>Keep strike</Button>{" "}
              <Button size="small" variant="danger" onClick={() => setPending({ strike, decision: "overturn" })}>Overturn and remove</Button>
            </>
          ) : null}
        </div>
      ))}
      <ConfirmActionDialog intent="moderation"
        isOpen={pending !== null}
        title={pending?.decision === "overturn" ? "Overturn this strike" : "Keep this strike"}
        consequences={pending?.decision === "overturn" ? ["The strike is revoked and no longer counts toward restrictions.", "The user is notified."] : ["The strike stays until it expires.", "The user is notified."]}
        confirmLabel={pending?.decision === "overturn" ? "Overturn" : "Keep strike"}
        tone={pending?.decision === "overturn" ? "danger" : "default"}
        requiresReason
        isBusy={mutation.isRunning}
        errorMessage={mutation.errorMessage}
        onConfirm={confirmAppealDecision}
        onClose={() => { mutation.clearError(); setPending(null); }}
      />
      <ConfirmActionDialog intent="moderation"
        isOpen={pendingOverride !== null}
        title={pendingOverride === "CLEAR" ? "Clear monetisation override" : pendingOverride === "ALLOW" ? "Allow monetisation override" : "Pause monetisation override"}
        consequences={["Changes the account's monetisation state immediately.", "Requires step-up verification and is written to the audit log."]}
        confirmLabel={pendingOverride === "CLEAR" ? "Clear override" : "Save override"}
        tone={pendingOverride === "PAUSE" ? "danger" : "default"}
        requiresReason
        requiresStepUp
        isBusy={overrideMutation.isRunning}
        errorMessage={overrideMutation.errorMessage}
        onConfirm={confirmMonetisationOverride}
        onClose={() => { overrideMutation.clearError(); setPendingOverride(null); }}
      />
    </Card>
  );
}
