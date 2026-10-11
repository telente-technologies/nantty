"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { SelectField } from "@/components/ui/formFields";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchLegalAcceptanceStats, rollbackLegalDocument } from "@/services/legalApi.service";
import type { LegalVersion } from "@/types/legal.type";
import { formatDateOnly, formatDateTime } from "@/utils/formatting.util";

import styles from "./legal.module.css";
import { LegalMarkdownPreview } from "./legalMarkdownPreview";
import { LegalVersionDiff } from "./legalVersionDiff";

const versionLabel = (version: LegalVersion) => `v${version.versionNumber}`;

function VersionDetailPanel({ version, onClose }: { readonly version: LegalVersion; readonly onClose: () => void }) {
  const acceptance = useAdminQuery((signal) => fetchLegalAcceptanceStats(version.id, signal), version.id, version.status === "PUBLISHED");
  return (
    <SidePanel isOpen onClose={onClose} width="wide" title={`Version ${version.versionNumber}`} subtitle={version.changeSummary}>
      <KeyValueList columns={2} items={[
        { label: "Status", value: <StatusBadge status={version.status} /> },
        { label: "Effective", value: formatDateOnly(version.effectiveAt) },
        { label: "Material change", value: version.isMaterialChange ? "Yes, users must re-accept" : "No" },
        { label: "Written by", value: `${version.createdByName}, ${formatDateTime(version.createdAt)}` },
        { label: "Submitted by", value: version.submittedByName ? `${version.submittedByName}, ${formatDateTime(version.submittedAt)}` : "Not submitted" },
        { label: "Published by", value: version.publishedByName ? `${version.publishedByName}, ${formatDateTime(version.publishedAt)}` : "Not published" },
        ...(version.rolledBackFromVersionNumber ? [{ label: "Restores", value: `Version ${version.rolledBackFromVersionNumber}` }] : []),
        ...(acceptance.data && acceptance.data.requiredCount > 0 ? [{ label: "Re-accepted", value: `${acceptance.data.acceptedCount.toLocaleString()} of ${acceptance.data.requiredCount.toLocaleString()} by ${formatDateOnly(acceptance.data.mustAcceptBy)}` }] : []),
      ]} />
      <SectionHeading>Text</SectionHeading>
      <LegalMarkdownPreview markdown={version.bodyMarkdown} />
    </SidePanel>
  );
}

interface LegalVersionHistoryProps {
  readonly documentKey: string;
  readonly versions: readonly LegalVersion[];
  readonly canEdit: boolean;
  readonly hasOpenVersion: boolean;
  readonly onChanged: () => void;
}

export function LegalVersionHistory({ documentKey, versions, canEdit, hasOpenVersion, onChanged }: LegalVersionHistoryProps) {
  const { showToast } = useToast();
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<LegalVersion | null>(null);
  const [leftId, setLeftId] = useState(versions[1]?.id ?? versions[0]?.id ?? "");
  const [rightId, setRightId] = useState(versions[0]?.id ?? "");
  const rollbackMutation = useAdminMutation((input: { fromVersionId: string; reason: string }) => rollbackLegalDocument(documentKey, input));
  const left = versions.find((version) => version.id === leftId);
  const right = versions.find((version) => version.id === rightId);
  const options = versions.map((version) => ({ value: version.id, label: `${versionLabel(version)} (${version.status.toLowerCase().replace("_", " ")})` }));

  const columns: readonly DataTableColumn<LegalVersion>[] = [
    { key: "version", header: "Version", render: (version) => versionLabel(version) },
    { key: "status", header: "Status", render: (version) => <StatusBadge status={version.status} /> },
    { key: "summary", header: "Change summary", render: (version) => version.changeSummary },
    { key: "material", header: "Material", render: (version) => (version.isMaterialChange ? "Yes" : "No") },
    { key: "effective", header: "Effective", render: (version) => formatDateOnly(version.effectiveAt) },
    { key: "by", header: "Published by", render: (version) => version.publishedByName ?? "" },
    { key: "actions", header: "", align: "end", render: (version) => (canEdit && !hasOpenVersion && version.status !== "DRAFT" && version.status !== "IN_REVIEW" && version.versionNumber !== versions.find((candidate) => candidate.status === "PUBLISHED")?.versionNumber ? <Button size="small" variant="ghost" onClick={(event) => { event.stopPropagation(); setRollbackTarget(version); }}>Roll back to this</Button> : null) },
  ];

  async function rollback(reason: string) {
    if (!rollbackTarget) return;
    const created = await rollbackMutation.run({ fromVersionId: rollbackTarget.id, reason });
    if (created) {
      showToast(`Draft version ${created.versionNumber} created from version ${rollbackTarget.versionNumber}. Submit it for review to publish.`);
      setRollbackTarget(null);
      onChanged();
    }
  }

  return (
    <div className={styles.stack}>
      <SectionHeading>All versions</SectionHeading>
      <DataTable caption="Version history" columns={columns} rows={versions} readRowKey={(version) => version.id} onRowOpen={(version) => setOpenedId(version.id)} selectedRowKey={openedId} />
      <SectionHeading>Compare</SectionHeading>
      <div className={styles.formGrid}>
        <SelectField label="Left" value={leftId} onChange={(event) => setLeftId(event.target.value)} options={options} />
        <SelectField label="Right" value={rightId} onChange={(event) => setRightId(event.target.value)} options={options} />
      </div>
      {left && right ? <LegalVersionDiff leftLabel={versionLabel(left)} rightLabel={versionLabel(right)} leftMarkdown={left.bodyMarkdown} rightMarkdown={right.bodyMarkdown} /> : null}
      {versions.find((version) => version.id === openedId) ? <VersionDetailPanel version={versions.find((version) => version.id === openedId) as LegalVersion} onClose={() => setOpenedId(null)} /> : null}
      {rollbackTarget ? <ConfirmActionDialog intent="restore" isOpen title={`Roll back to version ${rollbackTarget.versionNumber}`} confirmLabel="Create draft" isBusy={rollbackMutation.isRunning} errorMessage={rollbackMutation.errorMessage} consequences={["A new draft version is created with the old wording. Nothing changes for users until it is reviewed and published.", "The old version is never edited or deleted."]} onConfirm={rollback} onClose={() => { rollbackMutation.clearError(); setRollbackTarget(null); }} /> : null}
    </div>
  );
}
