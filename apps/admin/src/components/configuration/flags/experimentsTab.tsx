"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { experimentsEndpoint, fetchVersionedRecords } from "@/services/configurationApi.service";
import type { ExperimentContent } from "@/types/featureFlags.type";
import type { VersionedRecord } from "@/types/platformConfiguration.type";
import { formatDateOnly } from "@/utils/formatting.util";

import { VersionedRecordPanel } from "../shared/versionedRecordPanel";
import { blankExperimentContent, ExperimentEditor, findExperimentDraftProblem } from "./experimentEditor";
import styles from "./featureFlags.module.css";

type ExperimentRecord = VersionedRecord<ExperimentContent>;

export function ExperimentsTab({ canWrite }: { readonly canWrite: boolean }) {
  const { showToast } = useToast();
  const experiments = useAdminQuery((signal) => fetchVersionedRecords(experimentsEndpoint, signal), "experiments");
  const [openExperiment, setOpenExperiment] = useState<ExperimentRecord | "new" | null>(null);
  return (
    <>
      <Toolbar>
        {canWrite ? (
          <Button variant="primary" iconName="plus16" onClick={() => setOpenExperiment("new")}>
            New experiment
          </Button>
        ) : null}
      </Toolbar>
      {experiments.errorMessage ? <ErrorBlock message={experiments.errorMessage} onRetry={experiments.reload} /> : null}
      <DataTable<ExperimentRecord>
        caption="Experiments"
        rows={experiments.data?.items ?? []}
        isLoading={experiments.isLoading}
        readRowKey={(experiment) => experiment.id}
        onRowOpen={(experiment) => setOpenExperiment(experiment)}
        selectedRowKey={openExperiment && openExperiment !== "new" ? openExperiment.id : null}
        columns={[
          { key: "name", header: "Experiment", render: (experiment) => <span><strong>{experiment.content.name}</strong><br /><code className={styles.targeting}>{experiment.id}</code></span> },
          { key: "status", header: "Status", width: "110px", render: (experiment) => <StatusBadge status={experiment.content.status === "RUNNING" ? "LIVE" : experiment.content.status} label={experiment.content.status.charAt(0) + experiment.content.status.slice(1).toLowerCase()} /> },
          { key: "variants", header: "Variants", render: (experiment) => <span className={styles.targeting}>{experiment.content.variants.map((variant) => `${variant.key} ${variant.weightPercent}%`).join(" · ")}</span> },
          { key: "metric", header: "Primary metric", isMono: true, render: (experiment) => experiment.content.primaryMetric },
          { key: "started", header: "Started", width: "110px", render: (experiment) => formatDateOnly(experiment.content.startedAt) },
          { key: "version", header: "Version", width: "70px", isMono: true, render: (experiment) => `v${experiment.version}` },
        ]}
      />
      {openExperiment ? (
        <VersionedRecordPanel<ExperimentContent>
          key={openExperiment === "new" ? "new" : `${openExperiment.id}@${openExperiment.version}`}
          endpoint={experimentsEndpoint}
          record={openExperiment === "new" ? null : openExperiment}
          blankContent={blankExperimentContent}
          title={openExperiment === "new" ? "Experiment" : openExperiment.content.name}
          canWrite={canWrite}
          newRecordIdLabel="Experiment key"
          newRecordIdHint="Lowercase letters, digits and underscores, e.g. checkout_trust_badges."
          normalizeNewRecordId={(typed) => typed.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 64)}
          findDraftProblem={findExperimentDraftProblem}
          renderEditor={(content, updateContent, isWritable) => <ExperimentEditor experiment={content} savedStatus={openExperiment === "new" ? null : openExperiment.content.status} canWrite={isWritable} onChange={updateContent} />}
          onChanged={(record, verb) => {
            experiments.reload();
            setOpenExperiment(record);
            showToast(`Experiment ${record.id} ${verb} (v${record.version}).`);
          }}
          onClose={() => setOpenExperiment(null)}
        />
      ) : null}
    </>
  );
}
