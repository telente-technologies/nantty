"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { ErrorBlock, InlineError, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { SelectField, TextAreaField, TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { Card } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { trendRemovalReasonLabels } from "@/constants/rankingCaps.constant";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchTrendingModeration, saveTrendingModeration } from "@/services/rankingApi.service";
import type { TrendRemoval, TrendRemovalKind, TrendRemovalReason } from "@/types/ranking.type";
import { formatDateTime } from "@/utils/formatting.util";

import styles from "./ranking.module.css";

const kindOptions = [{ value: "hashtag", label: "Hashtag" }, { value: "topic", label: "Topic" }, { value: "headline", label: "Headline (story)" }];
const reasonOptions = Object.entries(trendRemovalReasonLabels).map(([value, label]) => ({ value, label }));

export function TrendModerationWorkspace() {
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const canWrite = can("content:review") || can("moderation:reports");
  const query = useAdminQuery((signal) => fetchTrendingModeration(signal), "trending-moderation");
  const save = useAdminMutation(saveTrendingModeration);
  const [kind, setKind] = useState<TrendRemovalKind>("hashtag");
  const [key, setKey] = useState("");
  const [country, setCountry] = useState("");
  const [reasonCode, setReasonCode] = useState<TrendRemovalReason>("spam");
  const [note, setNote] = useState("");
  const [auditReason, setAuditReason] = useState("");
  const removals = query.data?.value.removals ?? [];

  const persist = async (next: readonly TrendRemoval[], successMessage: string) => {
    if (!query.data) return;
    const saved = await save.run({ expectedVersion: query.data.version, reason: auditReason.trim(), removals: next });
    if (saved) {
      query.replaceData(() => saved);
      setKey("");
      setNote("");
      setAuditReason("");
      showToast(successMessage, "success");
    }
  };

  const removeTrend = () => {
    const normalised = key.trim().replace(/^#/, "").toLowerCase();
    void persist([...removals, { kind, key: normalised, country: country.trim().toUpperCase(), reason: reasonCode, note: note.trim(), removedAt: new Date().toISOString() }], `Removed ${kind} ${normalised}.`);
  };

  return (
    <>
      <PageHeader area="Trust & safety" title="Trends & headlines" description="Remove a trend or a What's happening story when it breaks policy. You can't add or pin trends; they come only from real engagement." />
      <div className={styles.stack}>
        <NoticeBanner tone="caution" title="Removal only">
          Every removal needs a policy reason and a note for the audit log. Restoring a trend is also logged. Manipulated trends are already excluded automatically.
        </NoticeBanner>
        {canWrite ? (
          <Card title="Remove a trend or headline">
            <div className={styles.form}>
              <SelectField label="Type" options={kindOptions} value={kind} onChange={(event) => setKind(event.target.value as TrendRemovalKind)} />
              <TextField label="Hashtag or story key" placeholder="buyfollowersng" value={key} onChange={(event) => setKey(event.target.value)} />
              <TextField label="Country (blank for everywhere)" placeholder="NG" maxLength={2} value={country} onChange={(event) => setCountry(event.target.value)} />
              <SelectField label="Policy reason" options={reasonOptions} value={reasonCode} onChange={(event) => setReasonCode(event.target.value as TrendRemovalReason)} />
              <TextAreaField className={styles.wide} label="Note for reviewers" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
              <TextField className={styles.wide} label="Reason for the audit log" hint="At least 5 characters." value={auditReason} onChange={(event) => setAuditReason(event.target.value)} />
            </div>
            {save.errorMessage ? <InlineError message={save.errorMessage} /> : null}
            <div className={styles.actions}>
              <Button variant="danger" isBusy={save.isRunning} disabled={key.trim() === "" || auditReason.trim().length < 5 || !query.data} onClick={removeTrend}>Remove</Button>
            </div>
          </Card>
        ) : null}
        {query.isLoading ? <LoadingBlock /> : query.errorMessage ? <ErrorBlock message={query.errorMessage} onRetry={query.reload} /> : (
          <DataTable<TrendRemoval>
            caption={`Removed trends and headlines (version ${query.data?.version ?? 0}, last changed by ${query.data?.updatedBy ?? "nobody"})`}
            rows={removals}
            readRowKey={(row) => `${row.kind}|${row.key}|${row.country}`}
            emptyMessage="Nothing has been removed."
            columns={[
              { key: "kind", header: "Type", render: (row) => row.kind },
              { key: "key", header: "Key", isMono: true, render: (row) => (row.kind === "headline" ? row.key : `#${row.key}`) },
              { key: "country", header: "Scope", render: (row) => row.country || "Everywhere" },
              { key: "reason", header: "Reason", render: (row) => trendRemovalReasonLabels[row.reason] },
              { key: "note", header: "Note", render: (row) => row.note || "—" },
              { key: "removedAt", header: "Removed", render: (row) => formatDateTime(row.removedAt) },
              { key: "restore", header: "", align: "end", render: (row) => (canWrite ? <Button size="small" variant="ghost" disabled={auditReason.trim().length < 5 || save.isRunning} onClick={() => void persist(removals.filter((item) => item !== row), `Restored ${row.key}.`)}>Restore</Button> : null) },
            ]}
          />
        )}
      </div>
    </>
  );
}
