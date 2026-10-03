import type { StatusTone } from "@/components/ui/statusBadge";
import type { MarketingCampaignKind, MarketingCampaignStatus } from "@/types/marketing.type";

export const marketingCampaignKindLabels: Record<MarketingCampaignKind, string> = {
  discount_code: "Discount code",
  product_discount: "Product discount",
  scheduled_sale: "Scheduled sale",
  flash_sale: "Flash sale",
  bundle: "Bundle",
  featured_products: "Featured products",
};

export const marketingCampaignStatusLabels: Record<MarketingCampaignStatus, string> = { draft: "Draft", scheduled: "Scheduled", active: "Active", ended: "Ended", paused: "Paused" };
export const marketingCampaignStatusTones: Record<MarketingCampaignStatus, StatusTone> = { draft: "neutral", scheduled: "info", active: "success", ended: "neutral", paused: "caution" };

export const marketingSectionTabs = [
  { href: "/marketing", label: "Campaigns", exact: true },
  { href: "/marketing/discounts", label: "Discount codes & product discounts" },
  { href: "/marketing/flash-sales", label: "Flash sales" },
  { href: "/marketing/bundles", label: "Bundles" },
  { href: "/marketing/featured", label: "Featured products" },
] as const;

export function formatRemainingTimeUntil(isoDate: string, now = Date.now()): string {
  const remainingMilliseconds = new Date(isoDate).getTime() - now;
  if (remainingMilliseconds <= 0) return "0m";
  const totalMinutes = Math.floor(remainingMilliseconds / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
