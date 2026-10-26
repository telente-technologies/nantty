"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { KeyValueList, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { LoginHistoryEntry, SecurityOverview, SecuritySession } from "@/types/security.type";
import { formatDateForDisplay, formatDateTimeForDisplay, formatRelativeTimeFromNow } from "@/utils/dateFormatting.util";

import styles from "./settings.module.css";

const loginOutcomePresentation: Record<LoginHistoryEntry["outcome"], { label: string; tone: "success" | "caution" | "error" }> = {
  success: { label: "Signed in", tone: "success" },
  wrong_password: { label: "Wrong password", tone: "caution" },
  blocked: { label: "Blocked", tone: "error" },
};

export function SecuritySettingsView() {
  const securityQuery = useSellerQuery<SecurityOverview>("/seller/security");
  const { showToast } = useToast();
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const security = securityQuery.data;

  async function signOutSession(session: SecuritySession) {
    setBusySessionId(session.id);
    try {
      await sendSellerApiRequest(`/seller/security/sessions/${encodeURIComponent(session.id)}`, { method: "DELETE" });
      securityQuery.replaceData((current) => (current ? { ...current, sessions: current.sessions.filter((candidate) => candidate.id !== session.id) } : current));
      showToast(`Signed out ${session.device}.`);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusySessionId(null);
    }
  }

  async function signOutEveryOtherSession() {
    setBusySessionId("others");
    try {
      const result = await sendSellerApiRequest<{ endedCount: number }>("/seller/security/sessions/sign-out-others", { method: "POST" });
      securityQuery.replaceData((current) => (current ? { ...current, sessions: current.sessions.filter((session) => session.isCurrent) } : current));
      showToast(`Signed out of ${result.endedCount} other ${result.endedCount === 1 ? "session" : "sessions"}.`);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusySessionId(null);
    }
  }

  if (securityQuery.isLoading && !security) return <LoadingBlock label="Loading security" />;
  if (!security) return <Callout tone="error" action={<Button size="small" onClick={securityQuery.reload}>Try again</Button>}>{securityQuery.errorMessage ?? "Security details could not load."}</Callout>;
  const otherSessionCount = security.sessions.filter((session) => !session.isCurrent).length;

  return (
    <>
      <Panel title="Sign-in protection" description="These settings belong to your Nantty account and also protect the app. Change them in the Nantty app under Profile › Security.">
        <div className={styles.formStack}>
          {security.twoStepVerification.enabled ? null : <Callout tone="caution" title="Turn on 2-step verification">Anyone with your password could get into your store and withdraw money. Add an authenticator app or email code in the Nantty app.</Callout>}
          <KeyValueList
            items={[
              { label: "2-step verification", value: security.twoStepVerification.enabled ? <StatusBadge tone="success">On · {security.twoStepVerification.method === "email" ? "Email code" : "Authenticator app"}</StatusBadge> : <StatusBadge tone="caution">Off</StatusBadge> },
              { label: "Password last changed", value: formatDateForDisplay(security.passwordChangedAt) },
            ]}
          />
        </div>
      </Panel>
      <Panel
        title="Where you are signed in"
        description="Dashboard and Nantty app sessions for your account."
        padded={false}
        actions={otherSessionCount > 0 ? <Button size="small" isBusy={busySessionId === "others"} onClick={() => void signOutEveryOtherSession()}>Sign out all others</Button> : null}
      >
        <DataTable<SecuritySession>
          caption="Active sessions"
          rows={security.sessions}
          readRowKey={(session) => session.id}
          emptyState="Only this session is active."
          columns={[
            { key: "device", header: "Device", render: (session) => <span className={styles.rowTitle}>{session.device}{session.isCurrent ? <StatusBadge tone="info">This device</StatusBadge> : null}</span> },
            { key: "app", header: "Where", hideBelowTablet: true, render: (session) => (session.app === "dashboard" ? "Dashboard" : "Nantty app") },
            { key: "location", header: "Location", hideBelowTablet: true, render: (session) => `${session.location} · ${session.ipAddress}` },
            { key: "lastActive", header: "Last active", render: (session) => (session.isCurrent ? "Now" : formatRelativeTimeFromNow(session.lastActiveAt)) },
            { key: "action", header: <span className="visuallyHidden">Action</span>, align: "end", render: (session) => (session.isCurrent ? null : <Button size="small" variant="ghost" isBusy={busySessionId === session.id} onClick={() => void signOutSession(session)}>Sign out</Button>) },
          ]}
        />
      </Panel>
      <Panel title="Recent sign-ins" description="Blocked attempts were stopped by Nantty. If you do not recognise a sign-in, change your password in the app." padded={false}>
        <DataTable<LoginHistoryEntry>
          caption="Sign-in history"
          rows={security.loginHistory}
          readRowKey={(entry) => entry.id}
          emptyState="No sign-ins yet."
          columns={[
            { key: "when", header: "When", render: (entry) => formatDateTimeForDisplay(entry.occurredAt) },
            { key: "outcome", header: "Result", render: (entry) => <StatusBadge tone={loginOutcomePresentation[entry.outcome].tone}>{loginOutcomePresentation[entry.outcome].label}</StatusBadge> },
            { key: "device", header: "Device", hideBelowTablet: true, render: (entry) => entry.device },
            { key: "location", header: "Location", render: (entry) => `${entry.location} · ${entry.ipAddress}` },
          ]}
        />
      </Panel>
    </>
  );
}
