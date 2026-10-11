"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DiffView } from "@/components/ui/diffView";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/sidePanel";
import { SectionHeading } from "@/components/ui/surfaces";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchVersionHistory, restoreRecordVersion, type VersionedCollectionEndpoint } from "@/services/configurationApi.service";
import type { VersionedRecord } from "@/types/platformConfiguration.type";
import { formatDateTime } from "@/utils/formatting.util";

import styles from "./versionedEditor.module.css";

interface VersionHistoryPanelProps<Content> {
  readonly isOpen: boolean;
  readonly title: string;
  readonly endpoint: VersionedCollectionEndpoint<Content>;
  readonly currentRecord: VersionedRecord<Content>;
  readonly canWrite: boolean;
  readonly onRestored: (record: VersionedRecord<Content>) => void;
  readonly onClose: () => void;
}

export function VersionHistoryPanel<Content>(props: VersionHistoryPanelProps<Content>) {
  return props.isOpen ? <OpenVersionHistoryPanel {...props} /> : null;
}

function OpenVersionHistoryPanel<Content>({ title, endpoint, currentRecord, canWrite, onRestored, onClose }: VersionHistoryPanelProps<Content>) {
  const history = useAdminQuery((signal) => fetchVersionHistory(endpoint, currentRecord.id, signal), `${endpoint.basePath}/${currentRecord.id}@${currentRecord.version}`);
  const [selectedVersion, setSelectedVersion] = useState<number>(currentRecord.version);
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const restore = useAdminMutation((reason: string) => restoreRecordVersion(endpoint, currentRecord.id, selectedVersion, { expectedVersion: currentRecord.version, reason }));

  const versions = history.data?.items ?? [];
  const selected = versions.find((version) => version.version === selectedVersion) ?? null;
  const previous = versions.find((version) => version.version === selectedVersion - 1) ?? null;

  async function confirmRestore(reason: string) {
    const restored = await restore.run(reason);
    if (restored) {
      setIsRestoreOpen(false);
      onRestored(restored);
    }
  }

  return (
    <SidePanel
      isOpen
      title={`${title} — history`}
      subtitle={`${versions.length || "…"} versions. Select one to compare with the version before it.`}
      onClose={onClose}
      width="wide"
      footer={
        canWrite && selected && selected.version !== currentRecord.version && !selected.isArchived ? (
          <Button variant="primary" iconName="refresh20" onClick={() => setIsRestoreOpen(true)}>
            Restore version {selected.version}
          </Button>
        ) : null
      }
    >
      {history.errorMessage ? <ErrorBlock error={history.error} message={history.errorMessage} onRetry={history.reload} /> : null}
      {history.isLoading && !history.data ? <LoadingBlock /> : null}
      <ul className={styles.historyList}>
        {versions.map((version) => (
          <li key={version.version}>
            <button type="button" className={version.version === selectedVersion ? `${styles.historyItem} ${styles.historyItemSelected}` : styles.historyItem} onClick={() => setSelectedVersion(version.version)} aria-pressed={version.version === selectedVersion}>
              <strong>
                v{version.version}
                {version.version === currentRecord.version ? " · current" : ""}
                {version.isArchived ? " · archived" : ""}
              </strong>
              <span className={styles.historyItemReason}>
                {version.updatedBy.name} · {formatDateTime(version.updatedAt)} — {version.changeReason}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <section>
          <SectionHeading>{previous ? `Changes from v${previous.version} to v${selected.version}` : `v${selected.version} — first version`}</SectionHeading>
          <div className={styles.diffScroll}>
            <DiffView before={previous?.content ?? null} after={selected.isArchived ? null : selected.content} isUnchangedHidden={previous !== null} />
          </div>
        </section>
      ) : null}
      <ConfirmActionDialog intent="restore"
        isOpen={isRestoreOpen}
        title={`Restore version ${selectedVersion}?`}
        description={`The content of v${selectedVersion} becomes the new version ${currentRecord.version + 1}. Nothing in the history is deleted.`}
        confirmLabel={`Restore as v${currentRecord.version + 1}`}
        requiresStepUp
        isBusy={restore.isRunning}
        errorMessage={restore.errorMessage}
        onConfirm={(reason) => void confirmRestore(reason)}
        onClose={() => setIsRestoreOpen(false)}
      />
    </SidePanel>
  );
}
