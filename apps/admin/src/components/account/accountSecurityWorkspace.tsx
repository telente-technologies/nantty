"use client";

import { useState } from "react";

import { ThemeSwitcher } from "@zudomart/web-kit";

import { useAdminSession } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, KeyValueList } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { PermissionSummary } from "@/components/admins/permissionChecklist";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { readErrorMessageForDisplay } from "@/services/adminApiClient.service";
import { fetchOwnAdminAccount, fetchOwnAdminSessions, regenerateOwnRecoveryCodes, revokeOwnAdminSession } from "@/services/platformApi.service";
import { formatDateTime, formatRelativeTimeFromNow } from "@/utils/formatting.util";

import styles from "./accountSecurity.module.css";
import { PasskeysCard } from "./passkeysCard";

export function AccountSecurityWorkspace() {
  const { admin, sessionStartedAtEpochSeconds, absoluteTimeoutSeconds } = useAdminSession();
  const { showToast } = useToast();
  const account = useAdminQuery((signal) => fetchOwnAdminAccount(signal), "account");
  const sessions = useAdminQuery((signal) => fetchOwnAdminSessions(signal), "sessions");
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[] | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  async function regenerateRecoveryCodes() {
    setIsRegenerating(true);
    try {
      setNewRecoveryCodes((await regenerateOwnRecoveryCodes()).recoveryCodes);
      account.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsRegenerating(false);
    }
  }

  async function revokeSession(sessionId: string) {
    try {
      await revokeOwnAdminSession(sessionId);
      showToast("That session was signed out.");
      sessions.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    }
  }

  return (
    <>
      <PageHeader area="Your account" title="Security" description="Your sign-in methods, recovery codes and where you're signed in." />
      {account.errorMessage ? <ErrorBlock error={account.error} message={account.errorMessage} onRetry={account.reload} /> : null}
      {account.isLoading && !account.data ? <LoadingBlock /> : null}
      <div className={styles.grid}>
        <Card title="Profile">
          <KeyValueList
            columns={2}
            items={[
              { label: "Name", value: admin.name },
              { label: "Email", value: admin.email, isMono: true },
              { label: "Role", value: <StatusBadge status={admin.role} hasDot={false} /> },
              { label: "Session ends by", value: formatDateTime(new Date((sessionStartedAtEpochSeconds + absoluteTimeoutSeconds) * 1000).toISOString()) },
            ]}
          />
        </Card>
        <Card title="Authenticator app">
          <div className={styles.stack}>
            <p>Two-step verification is <strong>on</strong> and cannot be turned off for admins.</p>
            <p className={styles.muted}>Recovery codes left: {account.data?.recoveryCodesRemaining ?? "—"}</p>
            <Button iconName="shield24" onClick={regenerateRecoveryCodes} isBusy={isRegenerating}>
              Create new recovery codes
            </Button>
            {newRecoveryCodes ? (
              <NoticeBanner tone="caution" title="Save these now. Your old codes no longer work.">
                <ul className={styles.codes}>
                  {newRecoveryCodes.map((code) => (
                    <li key={code}>{code}</li>
                  ))}
                </ul>
              </NoticeBanner>
            ) : null}
          </div>
        </Card>
        <PasskeysCard passkeys={account.data?.passkeys ?? []} onChanged={account.reload} />
        <Card title="Where you're signed in">
          <ul className={styles.list}>
            {(sessions.data?.items ?? []).map((session) => (
              <li key={session.id}>
                <span>
                  <strong>{session.userAgent.slice(0, 60)}</strong>
                  <span className={styles.muted}> · <span className="mono">{session.ipAddress}</span> · active {formatRelativeTimeFromNow(session.lastSeenAt)}</span>
                </span>
                {session.isCurrent ? <StatusBadge label="This session" tone="info" /> : <Button size="small" variant="quietDanger" onClick={() => void revokeSession(session.id)}>Sign out</Button>}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Appearance">
          <div className={styles.stack}>
            <p className={styles.muted}>Choose how the console looks on this and your other Zudomart apps. System follows your device setting.</p>
            <ThemeSwitcher label="Colour theme" />
          </div>
        </Card>
        <Card title="What you can do">
          {admin.role === "SUPERADMIN" ? <p>Every permission, including managing admins.</p> : <PermissionSummary permissions={admin.permissions} />}
        </Card>
      </div>
    </>
  );
}
