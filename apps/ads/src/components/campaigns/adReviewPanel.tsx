"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/feedback";
import { Card } from "@/components/ui/surfaces";
import { prohibitedCategories, restrictedCategories } from "@/constants/policy.constant";
import type { Ad } from "@/types/campaign.type";
import { formatDateAndTime } from "@/utils/dateRange.util";

import { ReviewStatusBadge } from "./reviewStatusBadge";
import styles from "./detailPages.module.css";

function findPolicyTitle(policyCode: string | null): string | null {
  if (!policyCode) return null;
  return [...prohibitedCategories, ...restrictedCategories].find((section) => section.code === policyCode)?.title ?? policyCode.replace(/_/g, " ");
}

interface AdReviewPanelProps {
  readonly ad: Ad;
  readonly canManage: boolean;
  readonly onOpenAppeal: () => void;
  readonly onOpenEditor: () => void;
}

export function AdReviewPanel({ ad, canManage, onOpenAppeal, onOpenEditor }: AdReviewPanelProps) {
  const { review } = ad;
  const policyTitle = findPolicyTitle(review.policyCode);
  return (
    <Card title="Review" actions={<ReviewStatusBadge review={review} />}>
      <div className={styles.stack}>
        {review.status === "not_submitted" ? <p className={styles.mutedText}>This ad is a draft. Send its campaign for review when you are ready — nothing is shown or charged until it is approved.</p> : null}
        {review.status === "pending" ? <InlineNotice tone="info" title="Checking against our policies">Most ads are reviewed within a few hours. This page refreshes on its own.</InlineNotice> : null}
        {review.status === "approved" ? <p className={styles.mutedText}>Approved{review.reviewedAt ? ` on ${formatDateAndTime(review.reviewedAt)}` : ""}. The ad can deliver while its campaign has budget and balance.</p> : null}
        {review.status === "rejected" ? (
          <>
            <div className={styles.reviewReason}>
              <strong>
                Rejected: {policyTitle}
                {review.reviewedAt ? ` · ${formatDateAndTime(review.reviewedAt)}` : ""}
              </strong>
              <p>{review.policyReason}</p>
            </div>
            {review.policyCode ? (
              <Link href={`/policy#${review.policyCode}`}>Read the {policyTitle?.toLowerCase()} policy</Link>
            ) : null}
          </>
        ) : null}
        {review.appeal ? (
          <InlineNotice tone={review.appeal.status === "pending" ? "info" : review.appeal.status === "overturned" ? "success" : "caution"} title={review.appeal.status === "pending" ? "Appeal in progress" : review.appeal.status === "overturned" ? "Appeal accepted" : "Appeal declined"}>
            <p>You wrote: “{review.appeal.message}”</p>
            {review.appeal.resolutionNote ? <p>{review.appeal.resolutionNote}</p> : null}
          </InlineNotice>
        ) : null}
        {canManage && review.status === "rejected" ? (
          <div className={styles.titleRow}>
            <Button variant="primary" iconName="textIndent24" onClick={onOpenEditor}>
              Edit ad
            </Button>
            {!review.appeal ? (
              <Button iconName="shield24" onClick={onOpenAppeal}>
                Appeal
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
