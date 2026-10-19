"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { CursorPagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchAdCashbackSettings } from "@/services/adCreditApi.service";
import type { AdCashbackSetting } from "@/types/adCredit.type";
import { formatDateTime } from "@/utils/formatting.util";

import { AdCashbackEditorDialog } from "./adCashbackEditorDialog";
import styles from "./adCredit.module.css";

function buildCashbackColumns(canManage: boolean, onEdit: (setting: AdCashbackSetting) => void): readonly DataTableColumn<AdCashbackSetting>[] {
  return [
    { key: "user", header: "User", render: (setting) => <span className={styles.stack}><span>@{setting.username}</span><span className={styles.muted}>{setting.userId}</span></span> },
    { key: "state", header: "Cashback", render: (setting) => <StatusBadge status={setting.enabled ? "ENABLED" : "DISABLED"} label={setting.enabled ? "On" : "Off"} /> },
    { key: "percent", header: "Percent", render: (setting) => <span className={styles.amount}>{setting.percent}%</span>, align: "end" },
    { key: "updated", header: "Last change", render: (setting) => <span className={styles.stack}><span>{setting.updatedBy?.name ?? "System"}</span><span className={styles.muted}>{formatDateTime(setting.updatedAt)}</span></span> },
    { key: "reason", header: "Reason", render: (setting) => <span className={styles.muted}>{setting.reason}</span>, width: "30%" },
    { key: "actions", header: <span className="visuallyHidden">Actions</span>, align: "end", render: (setting) => (canManage ? <Button size="small" onClick={() => onEdit(setting)} aria-label={`Edit cashback for @${setting.username}`}>Edit</Button> : null) },
  ];
}

export function AdCashbackPanel() {
  const { can } = useAdminPermissions();
  const canManage = can("advertisers:manage");
  const [cursor, setCursor] = useState<string | undefined>();
  const [editor, setEditor] = useState<{ readonly existing: AdCashbackSetting | null } | null>(null);
  const { data, errorMessage, error, isLoading, reload } = useAdminQuery((signal) => fetchAdCashbackSettings(cursor, signal), cursor ?? "first");

  return (
    <>
      <div className={styles.filters}>
        {canManage ? <Button variant="primary" iconName="plus16" onClick={() => setEditor({ existing: null })}>Add cashback user</Button> : null}
      </div>
      {errorMessage ? <ErrorBlock error={error} message={errorMessage} onRetry={reload} /> : null}
      <div className={styles.spacedTop}>
        <DataTable caption="Users with ad-spend cashback" columns={buildCashbackColumns(canManage, (existing) => setEditor({ existing }))} rows={data?.items ?? []} readRowKey={(setting) => setting.userId} isLoading={isLoading} emptyMessage="No user gets cashback yet." />
      </div>
      <CursorPagination cursor={cursor} nextCursor={data?.nextCursor} onCursorChange={setCursor} />
      {editor ? <AdCashbackEditorDialog existing={editor.existing} onClose={() => setEditor(null)} onSaved={reload} /> : null}
    </>
  );
}
