import type { CreatorSubscriptionStatus } from "@/types/creator.type";

export const CREATOR_SUBSCRIPTION_STATUS_PRESENTATION: Record<CreatorSubscriptionStatus, { readonly label: string; readonly tone: "neutral" | "success" | "warning" | "error" }> = {
  pending: { label: "Pending", tone: "warning" },
  active: { label: "Active", tone: "success" },
  past_due: { label: "Past due", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  failed: { label: "Failed", tone: "error" },
};

export const STORE_SUBSCRIPTION_SETTINGS_URLS = {
  apple_iap: "https://apps.apple.com/account/subscriptions",
  google_play: "https://play.google.com/store/account/subscriptions",
} as const;

export const canCancelCreatorSubscription = (status: CreatorSubscriptionStatus) => status === "active" || status === "past_due";
export const canResumeCreatorSubscription = (status: CreatorSubscriptionStatus) => status === "cancelled";

export function formatSubscriptionDay(isoDate: string | null): string | null {
  if (!isoDate) return null;
  return new Date(isoDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}
