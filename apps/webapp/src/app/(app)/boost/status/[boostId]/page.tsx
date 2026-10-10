"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { RetryButton } from "@/components/ui/controls";
import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { boostsService } from "@/services/boosts.service";
import { describeBoostPaymentMethod } from "@/utils/boostPayment.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "../../page.module.css";

export default function BoostStatusPage() {
  const params = useParams<{ boostId: string }>();
  const boost = useQuery({ queryKey: ["boosts", params.boostId], queryFn: () => boostsService.fetchBoostById(params.boostId), refetchInterval: 15000 });
  if (boost.isLoading) return <ListRowsSkeleton label="Loading boost status" rows={4} />;
  if (boost.isError || !boost.data) return <ErrorState description="We couldn't load this promotion." action={<RetryButton onRetry={() => boost.refetch()} />} />;
  const data = boost.data;
  const paidWith = describeBoostPaymentMethod(data.paymentMethod);
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Promotion status</h1>
      <div className={styles.card}>
        <span className={styles.pill}>{data.status}</span>
        <span className={styles.rowMeta}>Budget {formatMoneyForDisplay(data.totalBudget)} · Spent {formatMoneyForDisplay(data.spent)}{paidWith ? ` · Paid with ${paidWith}` : ""}</span>
        {data.status === "pending_payment" ? <span className={styles.note}>Waiting for your Paystack payment to be confirmed. This page updates on its own.</span> : null}
        {data.rejectionReason ? <span className={styles.error}>{data.rejectionReason}</span> : null}
      </div>
      <div className={styles.card}>
        <span className={styles.rowTitle}>Results</span>
        <span className={styles.rowMeta}>Impressions {data.results.impressions.toLocaleString()} · Reach {data.results.reach.toLocaleString()} · Profile visits {data.results.profileVisits.toLocaleString()} · Messages {data.results.messages.toLocaleString()}</span>
      </div>
      <div className={styles.links}>
        <Link className={styles.linkButton} href={`/boost/${data.postId}`}>Promote again</Link>
      </div>
    </div>
  );
}
