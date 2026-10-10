"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { RetryButton } from "@/components/ui/controls";
import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { creatorProgramService } from "@/services/creatorProgram.service";

import styles from "./page.module.css";

const BENEFITS: readonly { readonly title: string; readonly body: string }[] = [
  { title: "Go live", body: "Host live shows, pin products and chat with your audience in real time." },
  { title: "Receive gifts", body: "Fans send gifts during your lives — they turn into real earnings." },
  { title: "Earn affiliate commissions", body: "Promote sellers' products and earn a commission on every confirmed sale." },
  { title: "Fan subscriptions", body: "Offer monthly plans with perks for your most loyal followers." },
];

export default function CreatorProgramPage() {
  const eligibility = useQuery({ queryKey: ["creator", "eligibility"], queryFn: () => creatorProgramService.fetchMyCreatorEligibility() });
  const application = useQuery({ queryKey: ["creator", "application"], queryFn: () => creatorProgramService.fetchMyCreatorApplication() });
  const rules = useQuery({ queryKey: ["creator", "revenue-rules"], queryFn: () => creatorProgramService.fetchCreatorRevenueRules() });
  if (eligibility.isLoading) return <ListRowsSkeleton label="Loading creator program" rows={5} />;
  if (eligibility.isError) return <ErrorState description="We couldn't load the creator program." action={<RetryButton onRetry={() => eligibility.refetch()} />} />;
  const status = application.data?.status;
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Creator program</h1>
      <section className={styles.section} aria-label="Benefits">
        {BENEFITS.map((benefit) => (
          <div key={benefit.title} className={styles.card}>
            <span className={styles.rowTitle}>{benefit.title}</span>
            <span className={styles.rowMeta}>{benefit.body}</span>
          </div>
        ))}
      </section>
      <section className={styles.section} aria-label="Eligibility">
        <h2 className={styles.sectionTitle}>Eligibility</h2>
        <ul className={styles.list}>
          {(eligibility.data?.requirements ?? []).map((requirement) => (
            <li key={requirement.key} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{requirement.label}</span>
                <span className={styles.rowMeta}>{requirement.currentValue} / {requirement.requiredValue}</span>
              </span>
              <span className={styles.rowMeta}>{requirement.met ? "Met" : "Not met"}</span>
            </li>
          ))}
        </ul>
      </section>
      {status ? (
        <p className={styles.note}>Application status: {status}{application.data?.rejectionReason ? ` — ${application.data.rejectionReason}` : ""}</p>
      ) : null}
      {rules.data ? (
        <div className={styles.card}>
          <span className={styles.rowTitle}>Revenue share</span>
          <span className={styles.rowMeta}>Gifts up to {rules.data.giftCreatorSharePercentUpTo}% · Ads {rules.data.adsRevenueCreatorSharePercent}% · {rules.data.withdrawalFeeDescription}</span>
        </div>
      ) : null}
      <div className={styles.links}>
        {status === "approved" ? (
          <Link className={styles.primary} href="/creator">Open creator dashboard</Link>
        ) : status === "pending" ? (
          <span className={styles.note}>Your application is under review.</span>
        ) : (
          <Link className={styles.primary} href="/creator/apply">Apply now</Link>
        )}
      </div>
    </div>
  );
}
