"use client";

import { useState } from "react";

import { requestConfirmation } from "@nantty/web-kit";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, PageHeader } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { toolsApi } from "@/services/toolsApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { Experiment } from "@/types/tools.type";
import { formatDateRangeForDisplay } from "@/utils/dateRange.util";

import { CreateExperimentDialog } from "./createExperimentDialog";
import { experimentMetricLabels, experimentStatusDisplay, experimentVariableLabels } from "./toolLabels.constant";
import styles from "./toolsPage.module.css";

function ExperimentRow({ experiment, canManageTools, onStop }: { readonly experiment: Experiment; readonly canManageTools: boolean; readonly onStop: (experiment: Experiment) => void }) {
  const status = experimentStatusDisplay[experiment.status];
  return (
    <li className={styles.listRow}>
      <div className={styles.listMain}>
        <div className={styles.titleRow}>
          <h2>{experiment.name}</h2>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
        <p className={styles.muted}>
          {experiment.campaignName} · testing {experimentVariableLabels[experiment.variable].toLowerCase()} · winner: {experimentMetricLabels[experiment.metric].toLowerCase()} · {formatDateRangeForDisplay({ from: experiment.startAt.slice(0, 10), to: experiment.endAt.slice(0, 10) })}
        </p>
        <ul className={styles.arms} aria-label="Ad sets in this test">
          {experiment.arms.map((arm) => {
            const isWinner = experiment.result?.winnerAdSetId === arm.adSetId;
            return (
              <li key={arm.adSetId} className={isWinner ? `${styles.arm} ${styles.armWinner}` : styles.arm}>
                <strong>{arm.adSetName}</strong>
                <p className={styles.muted}>
                  {arm.trafficPercent}% of traffic{arm.note ? ` · ${arm.note}` : ""}
                  {isWinner ? " · leading" : ""}
                </p>
              </li>
            );
          })}
        </ul>
        {experiment.result ? (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            <p>{experiment.result.summary}</p>
            <div className={styles.confidence} role="meter" aria-label="Confidence in the result" aria-valuemin={0} aria-valuemax={100} aria-valuenow={experiment.result.confidencePercent}>
              <div className={styles.confidenceFill} style={{ width: `${experiment.result.confidencePercent}%` }} />
            </div>
            <p className={styles.muted}>{experiment.result.confidencePercent}% confidence. We call a winner at 90%.</p>
          </div>
        ) : (
          <p className={styles.muted} style={{ marginTop: 6 }}>Results appear after a few days of delivery.</p>
        )}
      </div>
      {canManageTools && (experiment.status === "running" || experiment.status === "draft") ? (
        <div className={styles.rowEnd}>
          <Button size="small" variant="danger" onClick={() => onStop(experiment)}>Stop test</Button>
        </div>
      ) : null}
    </li>
  );
}

export function ExperimentsPage() {
  const { accountId, canPerform } = useAdAccount();
  const { showToast } = useToast();
  const experimentsQuery = useAdsQuery(() => toolsApi.listExperiments(accountId), accountId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const canManageTools = canPerform("tools:manage");
  const experiments = experimentsQuery.data?.items ?? [];

  async function stopExperiment(experiment: Experiment) {
    if (!(await requestConfirmation({ title: `Stop "${experiment.name}"?`, description: "Both ad sets keep delivering normally.", confirmLabel: "Stop test", tone: "danger", intent: "stop" }))) return;
    try {
      await toolsApi.stopExperiment(accountId, experiment.id);
      showToast("Test stopped");
      experimentsQuery.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    }
  }

  return (
    <div className={styles.stack}>
      <PageHeader
        eyebrow="Tools"
        title="A/B tests"
        description="Find out which audience, creative, placement or bid works best, with people split so nobody sees both."
        actions={canManageTools ? <Button variant="primary" iconName="plus16" onClick={() => setIsCreateOpen(true)}>New test</Button> : null}
      />
      {experimentsQuery.errorMessage ? <ErrorState error={experimentsQuery.error} message={experimentsQuery.errorMessage} onRetry={experimentsQuery.reload} /> : null}
      <Card padded={false}>
        {experimentsQuery.isLoading && !experimentsQuery.data ? <LoadingBlock /> : null}
        {!experimentsQuery.isLoading && experiments.length === 0 ? <EmptyState iconName="repeat24" title="No tests yet" description="Duplicate an ad set, change one thing, then start a test to compare them fairly." /> : null}
        <ul className={styles.list}>
          {experiments.map((experiment) => (
            <ExperimentRow key={experiment.id} experiment={experiment} canManageTools={canManageTools} onStop={stopExperiment} />
          ))}
        </ul>
      </Card>
      {isCreateOpen ? (
        <CreateExperimentDialog
          accountId={accountId}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false);
            showToast("Test started");
            experimentsQuery.reload();
          }}
        />
      ) : null}
    </div>
  );
}
