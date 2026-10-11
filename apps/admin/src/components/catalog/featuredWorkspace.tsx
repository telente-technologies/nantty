"use client";

import { useState, type MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { readErrorMessageForDisplay } from "@/services/adminApiClient.service";
import { fetchMartHomeFeatures, fetchMartHomeImageLibrary, moveMartHomeFeature } from "@/services/catalogApi.service";
import type { MartHomeFeature } from "@/types/catalog.type";
import { humanizeConstantName } from "@/utils/formatting.util";

import styles from "./categoriesWorkspace.module.css";
import { FeatureDetailPanel } from "./featureDetailPanel";
import { FeatureEditorDialog } from "./featureEditorDialog";
import { FeaturePreviewCard } from "./featurePreviewCard";
import { describeFeatureSchedule } from "./featureScheduleText.util";

export function FeaturedWorkspace() {
  const { showToast } = useToast();
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ feature: MartHomeFeature | null } | null>(null);
  const [changeCounter, setChangeCounter] = useState(0);
  const features = useAdminQuery((signal) => fetchMartHomeFeatures(signal), `features:${changeCounter}`);
  const library = useAdminQuery((signal) => fetchMartHomeImageLibrary(signal), "image-library");
  const rows = features.data?.items ?? [];
  const selectedFeature = rows.find((feature) => feature.id === selectedFeatureId) ?? null;

  async function moveFeature(event: MouseEvent, feature: MartHomeFeature, direction: "up" | "down") {
    event.stopPropagation();
    try {
      const result = await moveMartHomeFeature(feature.id, direction);
      features.replaceData(() => result);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    }
  }

  const columns: DataTableColumn<MartHomeFeature>[] = [
    {
      key: "order",
      header: "Order",
      width: "96px",
      render: (feature) => (
        <span className={styles.orderButtons}>
          <Button size="small" variant="ghost" iconName="caretDown24" className={styles.upArrow} aria-label={`Move ${feature.title} up`} disabled={feature.id === rows[0]?.id} onClick={(event) => void moveFeature(event, feature, "up")} />
          <Button size="small" variant="ghost" iconName="caretDown24" aria-label={`Move ${feature.title} down`} disabled={feature.id === rows[rows.length - 1]?.id} onClick={(event) => void moveFeature(event, feature, "down")} />
        </span>
      ),
    },
    { key: "preview", header: "Preview", width: "90px", render: (feature) => <FeaturePreviewCard feature={feature} isThumbnail /> },
    { key: "title", header: "Feature", render: (feature) => (<span><strong>{feature.title}</strong><br /><span className={styles.muted}>{humanizeConstantName(feature.kind)}</span></span>) },
    { key: "target", header: "Opens", render: (feature) => (<span><span className={styles.muted}>{humanizeConstantName(feature.targetType)}</span> <code>{feature.targetValue}</code></span>) },
    { key: "countries", header: "Countries", isMono: true, render: (feature) => feature.countries.join(" ") },
    { key: "schedule", header: "Schedule", render: (feature) => <span className={styles.muted}>{describeFeatureSchedule(feature.startsAt, feature.endsAt)}</span> },
    { key: "status", header: "Status", render: (feature) => <StatusBadge status={feature.status} /> },
  ];

  function handleFeatureSaved(feature: MartHomeFeature, message: string) {
    setEditor(null);
    setSelectedFeatureId(feature.id);
    setChangeCounter((current) => current + 1);
    showToast(message);
  }

  return (
    <>
      <PageHeader area="Content" title="Mart home" description="Banners and featured slots on the Mart home screen, shown top to bottom in this order. Only live items within their schedule and country reach buyers." actions={<Button variant="primary" iconName="plus16" onClick={() => setEditor({ feature: null })} disabled={!library.data}>New feature</Button>} />
      {features.errorMessage ? <ErrorBlock error={features.error} message={features.errorMessage} onRetry={features.reload} /> : null}
      <DataTable caption="Mart home features in display order" columns={columns} rows={rows} readRowKey={(feature) => feature.id} onRowOpen={(feature) => setSelectedFeatureId(feature.id)} selectedRowKey={selectedFeatureId} isLoading={features.isLoading} emptyMessage="No features yet. Add a banner to fill the Mart home screen." />
      {selectedFeature ? <FeatureDetailPanel feature={selectedFeature} changeCounter={changeCounter} onClose={() => setSelectedFeatureId(null)} onEdit={() => setEditor({ feature: selectedFeature })} onChanged={(feature, message) => handleFeatureSaved(feature, message)} /> : null}
      {editor && library.data ? <FeatureEditorDialog editingFeature={editor.feature} imageLibrary={library.data.items} supportedCountries={library.data.countries} onClose={() => setEditor(null)} onSaved={(feature) => handleFeatureSaved(feature, editor.feature ? `${feature.title} saved` : `${feature.title} saved as draft`)} /> : null}
    </>
  );
}
