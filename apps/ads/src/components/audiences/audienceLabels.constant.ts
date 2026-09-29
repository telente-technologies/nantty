import type { BadgeTone } from "@/components/ui/statusBadge";
import type { CustomAudienceStatus, CustomAudienceType, EngagementSource } from "@/types/audience.type";

export const customAudienceTypeLabels: Record<CustomAudienceType, string> = {
  store_customers: "Store customers",
  engagers: "Engaged people",
  followers: "Followers",
  customer_list: "Customer list",
  lookalike: "Lookalike",
};

export const customAudienceStatusDisplay: Record<CustomAudienceStatus, { label: string; tone: BadgeTone }> = {
  building: { label: "Building", tone: "info" },
  ready: { label: "Ready", tone: "success" },
  too_small: { label: "Too small", tone: "caution" },
  failed: { label: "Failed", tone: "error" },
};

export const engagementSourceOptions: readonly { value: EngagementSource; label: string }[] = [
  { value: "any_post", label: "Liked, commented on or saved a post" },
  { value: "clips_watched", label: "Watched at least half of a clip" },
  { value: "live_viewers", label: "Joined a live shopping session" },
  { value: "saved_products", label: "Saved one of your products" },
  { value: "messaged", label: "Sent you a message" },
];

export const retentionDayOptions: readonly { value: string; label: string }[] = [
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 60 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 180 days" },
  { value: "365", label: "Last 365 days" },
];
