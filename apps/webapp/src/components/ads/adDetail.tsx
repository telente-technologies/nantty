"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { requestConfirmation } from "@/components/ui/confirmDialog";
import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { adsHubService } from "@/services/adsHub.service";
import { boostsService } from "@/services/boosts.service";
import { createIdempotencyKey, readErrorMessageForDisplay, WebappRequestError } from "@/services/clientApi.service";
import type { Boost } from "@/types/boost.type";
import { createIdempotencyKeyHolder, destinationNounFor, keyResultForBoost, scaleReportSeries } from "@/utils/adsHub.util";
import { boostDestinationOf, boostResultMetricsFor, boostViewTargetLabelFor } from "@/utils/boostDestination.util";
import { boostErrorMessageForCode, describeBoostPaymentMethod } from "@/utils/boostPayment.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { viewHrefForBoostDestination } from "@/utils/promotedEntityAd.util";

import { AdBudgetChangeDialog } from "./adBudgetChangeDialog";
import { AdSpendMeter, AdStatusChip, AdsManagerOptionalLink, formatAdDate } from "./adsHubParts";
import styles from "./adsHub.module.css";

const messageFor = (error: unknown) => boostErrorMessageForCode(error instanceof WebappRequestError ? error.code : null) ?? readErrorMessageForDisplay(error);

export function AdDetail({ boostId }: { readonly boostId: string }) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const keyHolder = useRef(createIdempotencyKeyHolder(() => createIdempotencyKey("ad-action")));
  const boost = useQuery({
    queryKey: ["ads", "boost", boostId],
    queryFn: () => boostsService.fetchBoostById(boostId),
    refetchInterval: (query) => (query.state.data?.status === "pending_payment" ? 5_000 : 30_000),
  });
  const report = useQuery({ queryKey: ["ads", "boost", boostId, "report"], queryFn: () => adsHubService.fetchBoostReport(boostId), enabled: Boolean(boost.data) && boost.data?.status !== "pending_payment", retry: false });

  const applyBoost = (updated: Boost) => {
    queryClient.setQueryData(["ads", "boost", boostId], updated);
    void queryClient.invalidateQueries({ queryKey: ["ads", "boosts"] });
    void queryClient.invalidateQueries({ queryKey: ["ads", "balance"] });
  };
  const statusAction = useMutation({
    mutationFn: (action: "pause" | "resume" | "stop") => {
      const key = keyHolder.current.keyFor({ boostId, action, status: boost.data?.status });
      if (action === "pause") return adsHubService.pauseBoost(boostId, key);
      if (action === "resume") return adsHubService.resumeBoost(boostId, key);
      return adsHubService.stopBoost(boostId, key);
    },
    onSuccess: (updated) => {
      setActionError(null);
      applyBoost(updated);
    },
    onError: (error) => {
      setActionError(messageFor(error));
      void boost.refetch();
    },
  });

  if (boost.isLoading) return <ListRowsSkeleton label="Loading your ad" rows={5} />;
  if (boost.isError || !boost.data) return <ErrorState description="We couldn't load this ad." error={boost.error} onRetry={() => void boost.refetch()} />;
  const data = boost.data;
  const destination = boostDestinationOf(data);
  const actions = data.actions ?? { pause: data.status === "active", resume: false, stop: ["pending_payment", "in_review", "active"].includes(data.status), changeBudget: false, resubmit: data.status === "rejected" };
  const paidWith = describeBoostPaymentMethod(data.paymentMethod);
  const startsOn = formatAdDate(data.startsAt ?? data.scheduledStartAt ?? null);
  const endsOn = formatAdDate(data.endsAt);
  const keyResult = keyResultForBoost(data);
  const confirmStop = async () => {
    const confirmed = await requestConfirmation({
      title: "Stop this ad?",
      description: "It stops showing straight away and can't be restarted. Unspent budget is handled as described in your ad balance.",
      confirmLabel: "Stop ad",
      intent: "stop",
    });
    if (confirmed) statusAction.mutate("stop");
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>{destinationNounFor(destination.type)} ad</h1>
        <Link className={styles.quietLink} href="/ads">All ads</Link>
      </div>
      <div className={styles.card}>
        <AdStatusChip status={data.status} />
        <AdSpendMeter spent={data.spent} budget={data.totalBudget} />
        <span className={styles.rowMeta}>
          {[startsOn ? `Starts ${startsOn}` : data.status === "in_review" ? "Starts after review" : null, endsOn ? `Ends ${endsOn}` : null, paidWith ? `Paid with ${paidWith}` : null].filter(Boolean).join(" · ")}
        </span>
        {data.dailyBudget && data.budgetType !== "total" ? <span className={styles.rowMeta}>Daily budget {formatMoneyForDisplay(data.dailyBudget)}</span> : null}
        {data.status === "pending_payment" ? <span className={styles.note}>Waiting for your payment to be confirmed. This page updates on its own.</span> : null}
        {data.status === "in_review" ? <span className={styles.note}>We&apos;re reviewing your ad. Most reviews finish within a day.</span> : null}
        {data.status === "rejected" ? (
          <div className={styles.section} role="status">
            <span className={styles.error}>{data.rejectionReason ?? "This ad wasn't approved."}</span>
            <span className={styles.note}>Money from a rejected ad stays in your ad credit and balance, so you can use it for the edited ad.</span>
          </div>
        ) : null}
      </div>
      <div className={styles.actions}>
        {actions.resubmit ? <Link className={styles.linkButton} href={`/ads/create?from=${encodeURIComponent(data.id)}&resubmit=1`}>Edit and resubmit</Link> : null}
        {actions.pause ? <Button variant="secondary" size="sm" busy={statusAction.isPending && statusAction.variables === "pause"} disabled={statusAction.isPending} onClick={() => statusAction.mutate("pause")}>Pause</Button> : null}
        {actions.resume ? <Button variant="secondary" size="sm" busy={statusAction.isPending && statusAction.variables === "resume"} disabled={statusAction.isPending} onClick={() => statusAction.mutate("resume")}>Resume</Button> : null}
        {actions.changeBudget ? <Button variant="secondary" size="sm" onClick={() => setBudgetDialogOpen(true)}>Extend or add budget</Button> : null}
        {actions.stop ? <Button variant="danger" size="sm" busy={statusAction.isPending && statusAction.variables === "stop"} disabled={statusAction.isPending} onClick={() => void confirmStop()}>Stop</Button> : null}
        <Link className={styles.linkButton} href={`/ads/create?from=${encodeURIComponent(data.id)}`}>Duplicate</Link>
        <Link className={styles.linkButton} href={viewHrefForBoostDestination(destination)}>{boostViewTargetLabelFor(destination.type)}</Link>
      </div>
      {actionError ? <p className={styles.error} role="alert">{actionError}</p> : null}

      <section className={styles.section} aria-label="Results">
        <h2 className={styles.sectionTitle}>Results</h2>
        <div className={styles.grid}>
          <Metric label={keyResult.label} value={keyResult.value.toLocaleString()} />
          {boostResultMetricsFor(data).filter((metric) => metric.label !== keyResult.label).map((metric) => <Metric key={metric.label} label={metric.label} value={metric.value.toLocaleString()} />)}
          {typeof data.results.clicks === "number" ? <Metric label="Ad taps" value={data.results.clicks.toLocaleString()} /> : null}
          <Metric label="Spent" value={formatMoneyForDisplay(data.spent)} />
          <Metric label="Cost per result" value={data.costPerResult ? formatMoneyForDisplay(data.costPerResult) : "—"} />
        </div>
        <AdDailyChart report={report.data} loading={report.isLoading} failed={report.isError} />
        <p className={styles.note}>Visits count taps on your ad. Messages count conversations started from the ad. Followers gained from an ad aren&apos;t tracked yet.</p>
      </section>
      <AdsManagerOptionalLink />
      {actions.changeBudget ? <AdBudgetChangeDialog boost={data} isOpen={budgetDialogOpen} onClose={() => setBudgetDialogOpen(false)} onApplied={applyBoost} /> : null}
    </div>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}

function AdDailyChart({ report, loading, failed }: { readonly report: Awaited<ReturnType<typeof adsHubService.fetchBoostReport>> | undefined; readonly loading: boolean; readonly failed: boolean }) {
  if (loading) return null;
  if (failed) return <p className={styles.note}>Daily results aren&apos;t available right now.</p>;
  if (!report || report.series.length === 0) return <p className={styles.note}>Daily results appear once your ad starts running.</p>;
  const bars = scaleReportSeries(report.series, "impressions");
  const summary = bars.map((bar) => `${bar.date}: ${bar.value.toLocaleString()}`).join(", ");
  return (
    <figure className={styles.card} aria-label="Impressions per day">
      <figcaption className={styles.label}>Impressions per day</figcaption>
      <div className={styles.chart} role="img" aria-label={`Impressions per day. ${summary}`}>
        {bars.map((bar) => <div key={bar.date} className={styles.chartBar} style={{ height: `${Math.max(bar.fraction * 100, 2)}%` }} title={`${bar.date}: ${bar.value.toLocaleString()}`} />)}
      </div>
      <div className={styles.chartAxis} aria-hidden="true">
        <span>{bars[0]?.date}</span>
        <span>{bars[bars.length - 1]?.date}</span>
      </div>
      <span className={styles.rowMeta}>Total {report.resultLabel.toLowerCase()}: {report.totals.results.toLocaleString()} · Spent {formatMoneyForDisplay(report.totals.spend)}</span>
    </figure>
  );
}
