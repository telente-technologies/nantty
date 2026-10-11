"use client";

import { useState } from "react";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchCatalogCategoryWithHistory, setCatalogCategoryActive } from "@/services/catalogApi.service";
import type { CatalogCategory } from "@/types/catalog.type";
import { formatDateTime, formatWholeNumber } from "@/utils/formatting.util";

interface CategoryDetailPanelProps {
  readonly category: CatalogCategory;
  readonly parentName: string | null;
  readonly changeCounter: number;
  readonly onClose: () => void;
  readonly onEdit: () => void;
  readonly onChanged: () => void;
}

export function CategoryDetailPanel({ category, parentName, changeCounter, onClose, onEdit, onChanged }: CategoryDetailPanelProps) {
  const { showToast } = useToast();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const detail = useAdminQuery((signal) => fetchCatalogCategoryWithHistory(category.id, signal), `${category.id}:${changeCounter}`);
  const toggleMutation = useAdminMutation((reason: string) => setCatalogCategoryActive(category.id, !category.isActive, reason));

  async function confirmToggle(reason: string) {
    const result = await toggleMutation.run(reason);
    if (!result) return;
    setIsConfirmOpen(false);
    showToast(category.isActive ? `${category.name} deactivated` : `${category.name} activated`);
    onChanged();
  }

  return (
    <SidePanel
      isOpen
      title={category.name}
      subtitle={<code>{category.id}</code>}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onEdit} iconName="slidersHorizontal24">
            Edit or move
          </Button>
          <Button variant={category.isActive ? "quietDanger" : "secondary"} onClick={() => setIsConfirmOpen(true)}>
            {category.isActive ? "Deactivate" : "Activate"}
          </Button>
        </>
      }
    >
      <KeyValueList
        columns={2}
        items={[
          { label: "Status", value: <StatusBadge status={category.isActive ? "ACTIVE" : "DISABLED"} label={category.isActive ? "Active" : "Inactive"} /> },
          { label: "Parent", value: parentName ?? "Top level" },
          { label: "Slug", value: category.slug, isMono: true },
          { label: "App icon", value: category.iconName ?? "—", isMono: true },
          { label: "Products", value: formatWholeNumber(category.productCount) },
          { label: "Last changed", value: formatDateTime(category.updatedAt) },
        ]}
      />
      <SectionHeading>History</SectionHeading>
      {detail.errorMessage ? <ErrorBlock message={detail.errorMessage} onRetry={detail.reload} /> : null}
      {detail.isLoading && !detail.data ? <LoadingBlock lines={3} /> : null}
      {detail.data ? <AuditHistoryList entries={detail.data.history} /> : null}
      <ConfirmActionDialog intent="tag"
        isOpen={isConfirmOpen}
        title={category.isActive ? `Deactivate ${category.name}?` : `Activate ${category.name}?`}
        consequences={
          category.isActive
            ? ["Buyers stop seeing this category in Mart and search filters.", "Sellers can't list new products in it; existing products stay live but uncategorised in browse.", ...(category.parentId === null ? ["Its subcategories are deactivated too."] : [])]
            : ["The category shows in Mart again and sellers can list products in it."]
        }
        confirmLabel={category.isActive ? "Deactivate category" : "Activate category"}
        tone={category.isActive ? "danger" : "default"}
        isBusy={toggleMutation.isRunning}
        errorMessage={toggleMutation.errorMessage}
        onConfirm={confirmToggle}
        onClose={() => setIsConfirmOpen(false)}
      />
    </SidePanel>
  );
}
