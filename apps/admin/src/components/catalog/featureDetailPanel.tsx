"use client";

import { useState } from "react";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchMartHomeFeatureWithHistory, setMartHomeFeaturePublished } from "@/services/catalogApi.service";
import type { MartHomeFeature } from "@/types/catalog.type";
import { formatDateTime, humanizeConstantName } from "@/utils/formatting.util";

import { FeaturePreviewCard } from "./featurePreviewCard";

interface FeatureDetailPanelProps {
  readonly feature: MartHomeFeature;
  readonly changeCounter: number;
  readonly onClose: () => void;
  readonly onEdit: () => void;
  readonly onChanged: (feature: MartHomeFeature, message: string) => void;
}

export function FeatureDetailPanel({ feature, changeCounter, onClose, onEdit, onChanged }: FeatureDetailPanelProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const detail = useAdminQuery((signal) => fetchMartHomeFeatureWithHistory(feature.id, signal), `${feature.id}:${changeCounter}`);
  const publishMutation = useAdminMutation((reason: string) => setMartHomeFeaturePublished(feature.id, !feature.isPublished, reason));

  async function confirmPublishChange(reason: string) {
    const result = await publishMutation.run(reason);
    if (!result) return;
    setIsConfirmOpen(false);
    onChanged(result.item, feature.isPublished ? `${feature.title} moved back to draft` : `${feature.title} published`);
  }

  return (
    <SidePanel
      isOpen
      width="wide"
      title={feature.title}
      subtitle={<code>{feature.id}</code>}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onEdit} iconName="slidersHorizontal24">
            Edit
          </Button>
          <Button variant={feature.isPublished ? "quietDanger" : "primary"} onClick={() => setIsConfirmOpen(true)}>
            {feature.isPublished ? "Unpublish" : "Publish"}
          </Button>
        </>
      }
    >
      <FeaturePreviewCard feature={feature} />
      <KeyValueList
        columns={2}
        items={[
          { label: "Status", value: <StatusBadge status={feature.status} /> },
          { label: "Placement", value: humanizeConstantName(feature.kind) },
          { label: "Opens", value: `${humanizeConstantName(feature.targetType)}: ${feature.targetValue}` },
          { label: "Countries", value: feature.countries.join(", "), isMono: true },
          { label: "Starts", value: formatDateTime(feature.startsAt) },
          { label: "Ends", value: feature.endsAt ? formatDateTime(feature.endsAt) : "No end date" },
          { label: "Position", value: `#${feature.priority}` },
          { label: "Last changed", value: formatDateTime(feature.updatedAt) },
        ]}
      />
      <SectionHeading>History</SectionHeading>
      {detail.isLoading && !detail.data ? <LoadingBlock lines={3} /> : null}
      {detail.errorMessage ? <ErrorBlock message={detail.errorMessage} onRetry={detail.reload} /> : null}
      {detail.data ? <AuditHistoryList entries={detail.data.history} /> : null}
      <ConfirmActionDialog intent="publish"
        isOpen={isConfirmOpen}
        title={feature.isPublished ? `Unpublish “${feature.title}”?` : `Publish “${feature.title}”?`}
        consequences={feature.isPublished ? ["It disappears from Mart home for every country within a few minutes.", "It stays here as a draft you can publish again."] : [`Buyers in ${feature.countries.join(", ")} see it from ${formatDateTime(feature.startsAt)}${feature.endsAt ? ` until ${formatDateTime(feature.endsAt)}` : ""}.`]}
        confirmLabel={feature.isPublished ? "Unpublish" : "Publish"}
        tone={feature.isPublished ? "danger" : "default"}
        isBusy={publishMutation.isRunning}
        errorMessage={publishMutation.errorMessage}
        onConfirm={confirmPublishChange}
        onClose={() => setIsConfirmOpen(false)}
      />
    </SidePanel>
  );
}
