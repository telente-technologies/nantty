"use client";

import { useQuery } from "@tanstack/react-query";

import { accountHealthService, accountStandingLabel } from "@/services/accountHealth.service";

import styles from "./accountHealthSummary.module.css";

const webappUrl = process.env.NEXT_PUBLIC_WEBAPP_URL ?? "https://app.zudomart.com";

export function AccountHealthSummary() {
  const { data: health } = useQuery({ queryKey: ["account", "status"], queryFn: accountHealthService.fetchMine, staleTime: 60_000 });
  if (!health) return null;
  const paused = [!health.canMonetise ? "earning from gifts and subscriptions" : null, !health.canGoLive ? "going live" : null].filter((item): item is string => item !== null);
  return (
    <section className={styles.card} data-status={health.status} aria-label="Account status">
      <div className={styles.top}>
        <strong>Account status</strong>
        <span className={styles.badge}>{accountStandingLabel(health.status)}</span>
      </div>
      <p className={styles.muted}>
        {health.activeStrikeCount} of {health.restrictionThreshold} active strikes. Strikes expire after {health.strikeLifetimeDays} days.
        {health.pendingTakedownCount > 0 ? ` ${health.pendingTakedownCount} copyright takedown deadline pending.` : ""}
      </p>
      {paused.length > 0 ? <p className={styles.muted}>Paused: {paused.join(" and ")}. Monetisation and live come back when strikes expire or an appeal succeeds.</p> : null}
      <a href={`${webappUrl}/settings/account-status`} target="_blank" rel="noopener noreferrer" className={styles.link}>View details, appeal or send a counter-notice</a>
    </section>
  );
}
