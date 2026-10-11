"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { LinkTabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchAdPolicyCategories } from "@/services/adsReviewApi.service";
import type { AdPolicyCategory } from "@/types/adsReview.type";
import { formatWholeNumber } from "@/utils/formatting.util";

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
  const [editingPolicy, setEditingPolicy] = useState<AdPolicyCategory | "new" | null>(null);
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const canManage = can("advertisers:manage");

  return (
    <>
      <PageHeader area="Trust & safety · Ads" title="Policy categories" description="The rules reviewers cite when they reject an ad." actions={canManage ? <Button variant="primary" iconName="plus16" onClick={() => setEditingPolicy("new")}>New category</Button> : null} />
      <LinkTabs label="Ads administration" items={advertiserSectionTabs} />
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Ad policy categories" columns={policyColumns} rows={data?.items ?? []} readRowKey={(policy) => policy.id} onRowOpen={canManage ? (policy) => setEditingPolicy(policy) : undefined} isLoading={isLoading} emptyMessage="No policy categories yet." />
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
