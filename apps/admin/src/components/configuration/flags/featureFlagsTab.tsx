"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DataTable } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { featureFlagsEndpoint, fetchVersionedRecords, saveVersionedRecord } from "@/services/configurationApi.service";
import type { FeatureFlagContent } from "@/types/featureFlags.type";
import type { VersionedRecord } from "@/types/platformConfiguration.type";

import { VersionedRecordPanel } from "../shared/versionedRecordPanel";
import styles from "./featureFlags.module.css";
import { blankFeatureFlagContent, FeatureFlagEditor, findFeatureFlagDraftProblem } from "./featureFlagEditor";

type FlagRecord = VersionedRecord<FeatureFlagContent>;

function describeTargeting(flag: FeatureFlagContent): string {
  const countries = flag.targeting.countries.length > 0 ? flag.targeting.countries.join(", ") : "All countries";
  const version = flag.targeting.minimumAppVersion ? ` · ≥ ${flag.targeting.minimumAppVersion}` : "";
  return `${countries} · ${flag.targeting.platforms.join("/")}${version}`;
}

export function FeatureFlagsTab({ canWrite }: { readonly canWrite: boolean }) {
  const { showToast } = useToast();
  const flags = useAdminQuery((signal) => fetchVersionedRecords(featureFlagsEndpoint, signal), "flags");
  const [openFlag, setOpenFlag] = useState<FlagRecord | "new" | null>(null);
  const [flagToToggle, setFlagToToggle] = useState<FlagRecord | null>(null);
  const toggle = useAdminMutation(({ flag, reason }: { flag: FlagRecord; reason: string }) => saveVersionedRecord(featureFlagsEndpoint, flag.id, { expectedVersion: flag.version, reason, content: { ...flag.content, isEnabled: !flag.content.isEnabled } }));

  async function confirmToggle(reason: string) {
    if (!flagToToggle) return;
    const saved = await toggle.run({ flag: flagToToggle, reason });
    if (saved) {
      setFlagToToggle(null);
      flags.reload();
      showToast(`${saved.id} turned ${saved.content.isEnabled ? "on" : "off"} (v${saved.version}).`);
    }
  }

  return (
    <>
      <Toolbar>
        {canWrite ? (
          <Button variant="primary" iconName="plus16" onClick={() => setOpenFlag("new")}>
            New flag
          </Button>
        ) : null}
      </Toolbar>
      {flags.errorMessage ? <ErrorBlock message={flags.errorMessage} onRetry={flags.reload} /> : null}
      <DataTable<FlagRecord>
        caption="Feature flags"
        rows={flags.data?.items ?? []}
        isLoading={flags.isLoading}
        readRowKey={(flag) => flag.id}
        onRowOpen={(flag) => setOpenFlag(flag)}
        selectedRowKey={openFlag && openFlag !== "new" ? openFlag.id : null}
        readRowTone={(flag) => (flag.content.isKillSwitch && flag.content.isEnabled ? "danger" : null)}
        columns={[
          { key: "key", header: "Flag", render: (flag) => <span><code className={styles.flagKey}>{flag.id}</code><br /><span className={styles.targeting}>{flag.content.description}</span></span> },
          { key: "status", header: "Status", width: "150px", render: (flag) => <span>{flag.content.isEnabled ? <StatusBadge label="On" tone="success" /> : <StatusBadge label="Off" tone="neutral" />} {flag.content.isKillSwitch ? <StatusBadge label="Kill switch" tone="danger" hasDot={false} /> : null}</span> },
          { key: "rollout", header: "Rollout", width: "80px", align: "end", isMono: true, render: (flag) => `${flag.content.rolloutPercent}%` },
          { key: "targeting", header: "Targeting", render: (flag) => <span className={styles.targeting}>{describeTargeting(flag.content)}</span> },
          { key: "version", header: "Version", width: "70px", isMono: true, render: (flag) => `v${flag.version}` },
          {
            key: "actions",
            header: <span className="visuallyHidden">Actions</span>,
            width: "110px",
            render: (flag) =>
              canWrite ? (
                <div className={styles.rowActions}>
                  <Button size="small" variant={flag.content.isEnabled ? "quietDanger" : "secondary"} onClick={(event) => { event.stopPropagation(); toggle.clearError(); setFlagToToggle(flag); }}>
                    {flag.content.isEnabled ? "Turn off" : "Turn on"}
                  </Button>
                </div>
              ) : null,
          },
        ]}
      />
      {openFlag ? (
        <VersionedRecordPanel<FeatureFlagContent>
          key={openFlag === "new" ? "new" : `${openFlag.id}@${openFlag.version}`}
          endpoint={featureFlagsEndpoint}
          record={openFlag === "new" ? null : openFlag}
          blankContent={blankFeatureFlagContent}
          title={openFlag === "new" ? "Feature flag" : `Flag ${openFlag.id}`}
          canWrite={canWrite}
          canArchive
          newRecordIdLabel="Flag key"
          newRecordIdHint="Lowercase letters, digits and underscores, e.g. live_shopping_polls. Apps read this key."
          normalizeNewRecordId={(typed) => typed.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 64)}
          findDraftProblem={findFeatureFlagDraftProblem}
          renderEditor={(content, updateContent, isWritable) => <FeatureFlagEditor flag={content} canWrite={isWritable} onChange={updateContent} />}
          onChanged={(record, verb) => {
            flags.reload();
            setOpenFlag(verb === "archived" ? null : record);
            showToast(`Flag ${record.id} ${verb} (v${record.version}).`);
          }}
          onClose={() => setOpenFlag(null)}
        />
      ) : null}
      <ConfirmActionDialog
        isOpen={flagToToggle !== null}
        title={flagToToggle ? `Turn ${flagToToggle.content.isEnabled ? "off" : "on"} ${flagToToggle.id}?` : ""}
        description={flagToToggle?.content.description}
        consequences={flagToToggle ? [flagToToggle.content.isEnabled ? "Apps stop showing this feature within about a minute." : `${flagToToggle.content.rolloutPercent}% of matching people get the feature within about a minute.`, `Saved as version ${flagToToggle.version + 1}.`] : []}
        confirmLabel={flagToToggle?.content.isEnabled ? "Turn off" : "Turn on"}
        tone={flagToToggle?.content.isEnabled ? "danger" : "default"}
        requiresStepUp
        isBusy={toggle.isRunning}
        errorMessage={toggle.errorMessage}
        onConfirm={(reason) => void confirmToggle(reason)}
        onClose={() => setFlagToToggle(null)}
      />
    </>
  );
}
