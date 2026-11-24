"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { SectionHeading } from "@/components/ui/surfaces";
import { LinkTabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchAdFrequencyPolicies, fetchAdPolicyCategories, updateAdFrequencyPolicy } from "@/services/adsReviewApi.service";
import type { AdFrequencyPolicy, AdPolicyCategory } from "@/types/adsReview.type";
import { formatWholeNumber, humanizeConstantName } from "@/utils/formatting.util";

import { AdPolicyEditorDialog } from "./adPolicyEditorDialog";
import { advertiserSectionTabs } from "./advertisersWorkspace";
import styles from "./trustShared.module.css";

const policyColumns: readonly DataTableColumn<AdPolicyCategory>[] = [
  { key: "name", header: "Category", render: (policy) => <span className={styles.targetCellText}><strong>{policy.name}</strong><span className={styles.muted}>{policy.description}</span></span> },
  { key: "severity", header: "Severity", width: "110px", render: (policy) => <StatusBadge status={policy.severity} /> },
  { key: "rejections", header: "Rejections", width: "110px", align: "end", isMono: true, render: (policy) => formatWholeNumber(policy.rejectionCount) },
  { key: "active", header: "State", width: "110px", render: (policy) => <StatusBadge label={policy.isActive ? "Active" : "Inactive"} tone={policy.isActive ? "success" : "neutral"} /> },
];

export function AdPoliciesWorkspace() {
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchAdPolicyCategories(signal), "ad-policies");
  const frequencyQuery = useAdminQuery((signal) => fetchAdFrequencyPolicies(signal), "ads-frequency-policies");
  const [editingPolicy, setEditingPolicy] = useState<AdPolicyCategory | "new" | null>(null);
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const canManage = can("advertisers:manage");
  const canEditFrequency = can("config:revenue");
  const frequencyMutation = useAdminMutation((policy: AdFrequencyPolicy) => updateAdFrequencyPolicy(policy.format, policy));

  async function toggleFrequencyActive(policy: AdFrequencyPolicy) {
    const updated = { ...policy, active: !policy.active };
    const result = await frequencyMutation.run(updated);
    if (result === null && frequencyMutation.errorMessage) return;
    showToast(`${humanizeConstantName(policy.format)} frequency cap ${updated.active ? "enabled" : "paused"}.`);
    frequencyQuery.reload();
  }

  const frequencyColumns: readonly DataTableColumn<AdFrequencyPolicy>[] = [
    { key: "format", header: "Surface / format", render: (row) => <strong>{humanizeConstantName(row.format)}</strong> },
    { key: "sessionCap", header: "Session cap", align: "end", isMono: true, render: (row) => row.sessionCap },
    { key: "hourCap", header: "Hourly cap", align: "end", isMono: true, render: (row) => row.hourCap },
    { key: "dayCap", header: "Daily cap", align: "end", isMono: true, render: (row) => row.dayCap },
    { key: "minGap", header: "Min gap slots", align: "end", isMono: true, render: (row) => row.minGapSlots },
    { key: "active", header: "State", render: (row) => <StatusBadge label={row.active ? "Active" : "Paused"} tone={row.active ? "success" : "neutral"} /> },
    { key: "action", header: "Action", render: (row) => (canEditFrequency ? <Button size="small" variant="secondary" disabled={frequencyMutation.isRunning} onClick={() => void toggleFrequencyActive(row)}>{row.active ? "Pause" : "Activate"}</Button> : null) },
  ];

  return (
    <>
      <PageHeader area="Trust & safety · Ads" title="Policy categories" description="The rules reviewers cite when they reject an ad, plus surface delivery frequency caps." actions={canManage ? <Button variant="primary" iconName="plus16" onClick={() => setEditingPolicy("new")}>New category</Button> : null} />
      <LinkTabs label="Ads administration" items={advertiserSectionTabs} />
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Ad policy categories" columns={policyColumns} rows={data?.items ?? []} readRowKey={(policy) => policy.id} onRowOpen={canManage ? (policy) => setEditingPolicy(policy) : undefined} isLoading={isLoading} emptyMessage="No policy categories yet." />
      <SectionHeading>Delivery frequency caps</SectionHeading>
      {frequencyQuery.errorMessage ? <ErrorBlock error={frequencyQuery.error} message={frequencyQuery.errorMessage} onRetry={frequencyQuery.reload} /> : null}
      <DataTable caption="Ad frequency policies" columns={frequencyColumns} rows={frequencyQuery.data?.frequency ?? []} readRowKey={(row) => row.format} isLoading={frequencyQuery.isLoading} emptyMessage="No frequency caps configured." />
      {editingPolicy ? (
        <AdPolicyEditorDialog
          policy={editingPolicy}
          onClose={() => setEditingPolicy(null)}
          onSaved={(saved) => {
            showToast(editingPolicy === "new" ? `Created “${saved.name}”.` : `Saved “${saved.name}”.`);
            setEditingPolicy(null);
            reload();
          }}
        />
      ) : null}
    </>
  );
}
