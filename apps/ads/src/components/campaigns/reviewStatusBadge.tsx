import { StatusBadge, type BadgeTone } from "@/components/ui/statusBadge";
import type { AdReview } from "@/types/campaign.type";

const reviewPresentation: Record<AdReview["status"], { tone: BadgeTone; label: string }> = {
  not_submitted: { tone: "neutral", label: "Not submitted" },
  pending: { tone: "info", label: "In review" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "error", label: "Rejected" },
};

export function ReviewStatusBadge({ review }: { readonly review: AdReview }) {
  const presentation = reviewPresentation[review.status];
  const appealSuffix = review.appeal?.status === "pending" ? " · appeal pending" : "";
  return (
    <StatusBadge tone={presentation.tone}>
      {presentation.label}
      {appealSuffix}
    </StatusBadge>
  );
}
