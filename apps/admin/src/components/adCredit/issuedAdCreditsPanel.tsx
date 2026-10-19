"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { CursorPagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchIssuedAdCredits } from "@/services/adCreditApi.service";
import type { AdCreditGrant, AdCreditSource, AdCreditStatus } from "@/types/adCredit.type";
import { adCreditSourceFilterOptions, adCreditStatusFilterOptions, canRevokeAdCredit, describeAdCreditExpiry, describeAdCreditSource } from "@/utils/adCredit.util";
import { formatDateTime, formatMoneyForDisplay } from "@/utils/formatting.util";

import styles from "./adCredit.module.css";
import { IssueAdCreditDialog } from "./issueAdCreditDialog";
import { RevokeAdCreditDialog } from "./revokeAdCreditDialog";

function buildIssuedCreditColumns(canManage: boolean, onRevoke: (credit: AdCreditGrant) => void): readonly DataTableColumn<AdCreditGrant>[] {
  return [
    { key: "user", header: "User", render: (credit) => <span className={styles.stack}><span>{credit.username ? `@${credit.username}` : credit.userId}</span><span className={styles.muted}>{describeAdCreditSource(credit.source)}</span></span> },
    { key: "amount", header: "Issued", render: (credit) => <span className={styles.amount}>{formatMoneyForDisplay(credit.amount)}</span>, align: "end" },
    { key: "remaining", header: "Remaining", render: (credit) => <span className={styles.amount}>{formatMoneyForDisplay(credit.remaining)}</span>, align: "end" },
    { key: "expiry", header: "Expiry", render: (credit) => describeAdCreditExpiry(credit.expiresAt) },
    { key: "status", header: "Status", render: (credit) => <StatusBadge status={credit.status} /> },
    { key: "issued", header: "Issued by", render: (credit) => <span className={styles.stack}><span>{credit.issuedBy?.name ?? "Automatic"}</span><span className={styles.muted}>{formatDateTime(credit.createdAt)}</span>{credit.revokedAt ? <span className={styles.muted}>Revoked {formatDateTime(credit.revokedAt)}{credit.revokedAmount ? ` · ${formatMoneyForDisplay(credit.revokedAmount)}` : ""}</span> : null}</span> },
    { key: "reason", header: "Reason", render: (credit) => <span className={styles.muted}>{credit.reason}</span>, width: "24%" },
    {
      key: "actions", header: <span className="visuallyHidden">Actions</span>, align: "end",
      render: (credit) => (canManage && canRevokeAdCredit(credit) ? <Button size="small" variant="quietDanger" onClick={() => onRevoke(credit)} aria-label={`Revoke ${formatMoneyForDisplay(credit.remaining)} unspent credit for ${credit.username ?? credit.userId}`}>Revoke</Button> : null),
    },
  ];
}

export function IssuedAdCreditsPanel() {
  const { can } = useAdminPermissions();
  const canManage = can("advertisers:manage");
  const [status, setStatus] = useState<"" | AdCreditStatus>("");
  const [source, setSource] = useState<"" | AdCreditSource>("");
  const [userId, setUserId] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [isIssuing, setIsIssuing] = useState(false);
  const [creditToRevoke, setCreditToRevoke] = useState<AdCreditGrant | null>(null);
  const filters = { status: status || undefined, source: source || undefined, userId: userId.trim() || undefined, cursor };
  const { data, errorMessage, error, isLoading, reload } = useAdminQuery((signal) => fetchIssuedAdCredits(filters, signal), JSON.stringify(filters));

  function resetCursorAfter<Value>(setter: (value: Value) => void) {
    return (value: Value) => { setter(value); setCursor(undefined); };
  }

  return (
    <>
      <div className={styles.filters}>
        <SelectField label="Status" value={status} options={adCreditStatusFilterOptions} onChange={(event) => resetCursorAfter(setStatus)(event.target.value as "" | AdCreditStatus)} />
        <SelectField label="Source" value={source} options={adCreditSourceFilterOptions} onChange={(event) => resetCursorAfter(setSource)(event.target.value as "" | AdCreditSource)} />
        <TextField label="User ID" value={userId} onChange={(event) => resetCursorAfter(setUserId)(event.target.value)} autoComplete="off" spellCheck={false} />
        {canManage ? <Button variant="primary" iconName="plus16" onClick={() => setIsIssuing(true)}>Issue ad credit</Button> : null}
      </div>
      {errorMessage ? <ErrorBlock error={error} message={errorMessage} onRetry={reload} /> : null}
      <div className={styles.spacedTop}>
        <DataTable caption="Issued ad credit" columns={buildIssuedCreditColumns(canManage, setCreditToRevoke)} rows={data?.items ?? []} readRowKey={(credit) => credit.id} isLoading={isLoading} emptyMessage="No ad credit matches these filters." />
      </div>
      <CursorPagination cursor={cursor} nextCursor={data?.nextCursor} onCursorChange={setCursor} />
      {isIssuing ? <IssueAdCreditDialog isOpen onClose={() => setIsIssuing(false)} onIssued={reload} /> : null}
      <RevokeAdCreditDialog credit={creditToRevoke} onClose={() => setCreditToRevoke(null)} onRevoked={reload} />
    </>
  );
}
