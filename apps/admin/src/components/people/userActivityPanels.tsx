"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, KeyValueList } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchCreatorViolations, forceLogoutPlatformUser, recordCreatorViolation } from "@/services/peopleApi.service";
import type { CreatorViolation, UserDetail, UserSession, UserStrike, UserWalletBalance } from "@/types/peopleUsers.type";
import { formatDateOnly, formatDateTime, formatMoneyForDisplay, formatRelativeTimeFromNow, formatWholeNumber, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./peopleWorkspace.module.css";

export function UserSessionsPanel({ detail, canForceLogout, onUpdated }: { readonly detail: UserDetail; readonly canForceLogout: boolean; readonly onUpdated: (detail: UserDetail) => void }) {
  const { showToast } = useToast();
  const [targetSession, setTargetSession] = useState<UserSession | "ALL" | null>(null);
  const logoutMutation = useAdminMutation((input: { reason: string; sessionId?: string }) => forceLogoutPlatformUser(detail.user.id, input));

  async function signOutSessions(reason: string) {
    const updated = await logoutMutation.run({ reason, sessionId: targetSession === "ALL" || !targetSession ? undefined : targetSession.id });
    if (!updated) return;
    onUpdated(updated);
    setTargetSession(null);
    showToast(targetSession === "ALL" ? "Signed out of every device" : "Session signed out");
  }

  const columns: DataTableColumn<UserSession>[] = [
    { key: "device", header: "Device", render: (session) => <strong>{session.device}</strong> },
    { key: "platform", header: "Platform", render: (session) => humanizeConstantName(session.platform) },
    { key: "location", header: "Location", render: (session) => session.location },
    { key: "ip", header: "IP address", render: (session) => session.ipAddress, isMono: true },
    { key: "started", header: "Signed in", render: (session) => formatDateTime(session.startedAt) },
    { key: "seen", header: "Last seen", render: (session) => formatRelativeTimeFromNow(session.lastSeenAt) },
    ...(canForceLogout ? [{ key: "action", header: "", align: "end" as const, render: (session: UserSession) => <Button size="small" variant="quietDanger" onClick={() => setTargetSession(session)}>Sign out</Button> }] : []),
  ];

  return (
    <Card title="Active sessions" isFlush actions={canForceLogout && detail.sessions.length > 0 ? <Button size="small" variant="quietDanger" onClick={() => setTargetSession("ALL")}>Sign out everywhere</Button> : null}>
      <DataTable caption="Active sessions" columns={columns} rows={detail.sessions} readRowKey={(session) => session.id} emptyMessage="No active sessions." />
      <ConfirmActionDialog intent="signOut"
        isOpen={targetSession !== null}
        title={targetSession === "ALL" ? "Sign out of every device" : "Sign out this session"}
        description={targetSession === "ALL" ? `@${detail.user.username} will need to sign in again on every device.` : targetSession ? `${targetSession.device} · ${targetSession.location}` : undefined}
        confirmLabel={targetSession === "ALL" ? "Sign out everywhere" : "Sign out session"}
        tone="danger"
        isBusy={logoutMutation.isRunning}
        errorMessage={logoutMutation.errorMessage}
        onConfirm={signOutSessions}
        onClose={() => setTargetSession(null)}
      />
    </Card>
  );
}

const balanceColumns: readonly DataTableColumn<UserWalletBalance>[] = [
  { key: "currency", header: "Currency", render: (balance) => balance.currency, isMono: true },
  { key: "available", header: "Available", render: (balance) => formatMoneyForDisplay(balance.available), align: "end", isMono: true },
  { key: "pending", header: "Pending", render: (balance) => formatMoneyForDisplay(balance.pending), align: "end", isMono: true },
  { key: "escrow", header: "In escrow", render: (balance) => formatMoneyForDisplay(balance.inEscrow), align: "end", isMono: true },
];

export function UserWalletPanel({ detail }: { readonly detail: UserDetail }) {
  return (
    <>
      <Card title="Wallet balances" isFlush>
        <DataTable caption="Wallet balances" columns={balanceColumns} rows={detail.wallet.balances} readRowKey={(balance) => balance.currency} emptyMessage="This user has no wallet yet." />
      </Card>
      <Card title="Coins and withdrawals">
        <KeyValueList
          columns={2}
          items={[
            { label: "Coin balance", value: formatWholeNumber(detail.wallet.coinBalance), isMono: true },
            { label: "Pending withdrawals", value: detail.wallet.pendingWithdrawalCount },
          ]}
        />
        <p className={styles.faint}>Read-only. Money moves only through payouts, refunds and the ledger.</p>
      </Card>
    </>
  );
}

export function UserStrikesPanel({ detail, canManageCreatorViolations }: { readonly detail: UserDetail; readonly canManageCreatorViolations: boolean }) {
  const { showToast } = useToast();
  const [recordOpen, setRecordOpen] = useState(false);
  const creatorViolations = useAdminQuery(
    (signal) => (canManageCreatorViolations ? fetchCreatorViolations(detail.user.id, signal) : Promise.resolve({ data: [] })),
    `creator-violations-${detail.user.id}-${canManageCreatorViolations}`,
  );
  const recordMutation = useAdminMutation((reason: string) => recordCreatorViolation(detail.user.id, reason));

  async function submitViolation(reason: string) {
    const created = await recordMutation.run(reason);
    if (!created) return;
    setRecordOpen(false);
    showToast("Creator violation recorded.");
    creatorViolations.reload();
  }

  return (
    <div className={styles.stack}>
      {detail.strikes.length === 0 ? (
        <Card title="Strikes"><EmptyState title="No strikes" description="This account is in good standing." /></Card>
      ) : (
        <Card title="Strikes">
          <ul className={styles.list}>
            {detail.strikes.map((strike: UserStrike) => (
              <li key={strike.id} className={styles.listItem}>
                <span>
                  <strong>{strike.policy}</strong> <StatusBadge label={humanizeConstantName(strike.source)} tone={strike.source === "COPYRIGHT" ? "caution" : "neutral"} hasDot={false} />
                  <br />
                  <span className={styles.muted}>{strike.reason}</span>
                </span>
                <span className={styles.faint}>
                  {formatDateOnly(strike.issuedAt)} by {strike.issuedByName}
                  <br />
                  {strike.expiresAt ? `Expires ${formatDateOnly(strike.expiresAt)}` : "Does not expire"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {canManageCreatorViolations ? (
        <Card
          title="Creator Program violations"
          actions={<Button size="small" variant="secondary" onClick={() => setRecordOpen(true)}>Record violation</Button>}
        >
          {(creatorViolations.data?.data ?? []).length === 0 ? (
            <EmptyState title="No creator violations" description="No Creator Program policy violations recorded." />
          ) : (
            <ul className={styles.list}>
              {(creatorViolations.data?.data ?? []).map((violation: CreatorViolation) => (
                <li key={violation.id} className={styles.listItem}>
                  <span>
                    <strong>{humanizeConstantName(violation.source)}</strong>
                    <br />
                    <span className={styles.muted}>{violation.reason}</span>
                  </span>
                  <span className={styles.faint}>
                    {formatDateOnly(violation.createdAt)} · {violation.recordedBy}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ConfirmActionDialog
            isOpen={recordOpen}
            title="Record creator violation"
            description={`Logs a Creator Program policy violation against @${detail.user.username}. Violations affect creator tier eligibility and automatic verification.`}
            confirmLabel="Record violation"
            requiresReason
            requiresStepUp
            isBusy={recordMutation.isRunning}
            errorMessage={recordMutation.errorMessage}
            onConfirm={submitViolation}
            onClose={() => { recordMutation.clearError(); setRecordOpen(false); }}
          />
        </Card>
      ) : null}
    </div>
  );
}
