"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { privacyService } from "@/services/privacy.service";
import type { DataExportStatus } from "@/types/privacy.type";

import styles from "./settings.module.css";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";

const statusCopy: Record<DataExportStatus, string> = {
  none: "Get a copy of the personal information we hold about you.",
  requested: "Request received. We're getting your data ready.",
  processing: "Preparing your data. This can take a few minutes.",
  ready: "Your data is ready to download.",
};

const dataExportQueryKey = ["privacy", "dataExport"] as const;

export function DataExportSection() {
  const queryClient = useQueryClient();
  const exportQuery = useQuery({
    queryKey: dataExportQueryKey,
    queryFn: privacyService.fetchMyDataExport,
    refetchInterval: (query) => (query.state.data?.status === "requested" || query.state.data?.status === "processing" ? 2000 : false),
  });
  const requestExport = useMutation({ mutationFn: privacyService.requestMyDataExport, onSuccess: (request) => queryClient.setQueryData(dataExportQueryKey, request) });

  if (exportQuery.isLoading) return <ListRowsSkeleton label="Loading your data export" rows={2} withAvatar={false} />;
  if (exportQuery.isError || !exportQuery.data) return <ErrorState description="We couldn't load your data export." error={exportQuery.error} onRetry={() => void exportQuery.refetch()} />;

  const { status, downloadUrl, expiresAt } = exportQuery.data;
  const isInProgress = status === "requested" || status === "processing";
  return (
    <section className={styles.block} aria-labelledby="data-export-heading">
      <h2 id="data-export-heading" className={styles.blockHeading}>Download my data</h2>
      <p className={styles.muted} aria-live="polite">{statusCopy[status]}</p>
      {status === "ready" && expiresAt ? <p className={styles.muted}>Link expires {new Date(expiresAt).toLocaleDateString()}.</p> : null}
      {requestExport.isError ? <p className={styles.errorText} role="alert">{requestExport.error.message}</p> : null}
      <div className={styles.buttonRow}>
        {status === "ready" && downloadUrl ? <a href={downloadUrl} className={styles.downloadLink} download>Download</a> : null}
        <Button variant="secondary" disabled={isInProgress} busy={requestExport.isPending} onClick={() => requestExport.mutate()}>
          {status === "none" ? "Request my data" : "Request a new export"}
        </Button>
      </div>
    </section>
  );
}
