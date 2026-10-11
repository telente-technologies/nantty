"use client";

import Link from "next/link";
import { useState } from "react";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { ErrorBlock, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/ui/userIdentity";
import { VerificationBadge } from "@/components/ui/verificationBadge";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchPlatformUserDetail } from "@/services/peopleApi.service";
import type { UserDetail } from "@/types/peopleUsers.type";
import { formatDateTime } from "@/utils/formatting.util";

import { UserSessionsPanel, UserStrikesPanel, UserWalletPanel } from "./userActivityPanels";
import { UserModerationActions } from "./userModerationActions";
import { UserAccountHealthCard } from "./userAccountHealthCard";
import { UserProfilePanel } from "./userProfilePanel";
import { UserUsernamePanel } from "./userUsernamePanel";
import styles from "./peopleWorkspace.module.css";

type UserDetailTab = "profile" | "sessions" | "wallet" | "strikes" | "usernames" | "history";

export function UserDetailWorkspace({ userId }: { readonly userId: string }) {
  const { can } = useAdminPermissions();
  const [activeTab, setActiveTab] = useState<UserDetailTab>("profile");
  const { data: detail, errorMessage, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchPlatformUserDetail(userId, signal), userId);
  const acceptUpdatedDetail = (updated: UserDetail) => replaceData(() => updated);

  if (errorMessage) return <ErrorBlock variant="section" message={errorMessage} onRetry={reload} />;
  if (isLoading || !detail) return <LoadingBlock lines={8} />;
  const { user } = detail;
  const tabs = [
    { key: "profile" as const, label: "Profile" },
    { key: "sessions" as const, label: "Sessions", count: detail.sessions.length },
    { key: "wallet" as const, label: "Wallet" },
    { key: "strikes" as const, label: "Strikes", count: detail.strikes.length },
    { key: "usernames" as const, label: "Username" },
    { key: "history" as const, label: "Admin history", count: detail.history.length },
  ];

  return (
    <>
      <PageHeader
        area="People · Users"
        title={
          <span className={styles.headerIdentity}>
            <UserAvatar user={user} size={40} />
            <span>
              {user.displayName} <span className={styles.muted}>@{user.username}</span>
            </span>
          </span>
        }
        meta={
          <>
            <StatusBadge status={user.status} />
            {user.verification ? <VerificationBadge verification={user.verification} isLabelShown /> : <StatusBadge label="Not verified" tone="neutral" hasDot={false} />}
            {user.isSeller ? <StatusBadge label="Seller" tone="info" hasDot={false} /> : null}
            {user.isCreator ? <StatusBadge label="Creator Program" tone="brand" hasDot={false} /> : null}
            <span className="mono">{user.id}</span>
            <Link href="/users">All users</Link>
          </>
        }
        actions={<UserModerationActions detail={detail} onUpdated={acceptUpdatedDetail} />}
      />
      {detail.restriction ? (
        <NoticeBanner tone="danger" title={detail.restriction.kind === "BAN" ? "Banned" : "Suspended"}>
          {detail.restriction.reason} · since {formatDateTime(detail.restriction.startedAt)} · {detail.restriction.endsAt ? `ends ${formatDateTime(detail.restriction.endsAt)}` : "permanent"}
        </NoticeBanner>
      ) : null}
      <div className={styles.stack}>
        <UserAccountHealthCard userId={user.id} />
        <SegmentedTabs label="User sections" items={tabs} activeKey={activeTab} onChange={setActiveTab} />
        {activeTab === "profile" ? <UserProfilePanel detail={detail} canRevealPersonalData={can("users:read-pii")} /> : null}
        {activeTab === "sessions" ? <UserSessionsPanel detail={detail} canForceLogout={can("users:moderate")} onUpdated={acceptUpdatedDetail} /> : null}
        {activeTab === "wallet" ? <UserWalletPanel detail={detail} /> : null}
        {activeTab === "strikes" ? <UserStrikesPanel detail={detail} /> : null}
        {activeTab === "usernames" ? <UserUsernamePanel detail={detail} canManageUsernames={can("usernames:manage")} onUpdated={acceptUpdatedDetail} onReload={reload} /> : null}
        {activeTab === "history" ? (
          <Card title="Admin actions on this account">
            <AuditHistoryList entries={detail.history} />
          </Card>
        ) : null}
      </div>
    </>
  );
}
