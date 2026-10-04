import type { AdPlacement, BidStrategyType, CampaignObjective, DeliveryStatus } from "@/types/campaign.type";
import type { CallToAction, CreativeType, CreativeFormat } from "@/types/creative.type";

export interface ObjectiveOption {
  readonly objective: CampaignObjective;
  readonly label: string;
  readonly description: string;
  readonly resultLabel: string;
  readonly group: "awareness" | "consideration" | "conversion";
  readonly defaultCallToAction: CallToAction;
}

export const objectiveOptions: readonly ObjectiveOption[] = [
  { objective: "awareness", label: "Awareness & reach", description: "Show your ad to as many people as possible in your audience.", resultLabel: "Reach", group: "awareness", defaultCallToAction: "learn_more" },
  { objective: "traffic", label: "Traffic & profile visits", description: "Send people to your profile, store, product page or a website.", resultLabel: "Link clicks", group: "consideration", defaultCallToAction: "learn_more" },
  { objective: "engagement", label: "Engagement", description: "Get more likes, comments, reposts and reel views.", resultLabel: "Engagements", group: "consideration", defaultCallToAction: "watch_more" },
  { objective: "messages", label: "Messages", description: "Start conversations with buyers in Zudomart messages.", resultLabel: "Conversations started", group: "consideration", defaultCallToAction: "send_message" },
  { objective: "followers", label: "Followers", description: "Grow the people who follow your profile or store.", resultLabel: "Follows", group: "consideration", defaultCallToAction: "follow" },
  { objective: "store_promotion", label: "Store promotion", description: "Bring people into your Zudomart store in the app.", resultLabel: "Store visits", group: "conversion", defaultCallToAction: "visit_store" },
  { objective: "sales", label: "Sales", description: "Find buyers. Orders in your Zudomart store are attributed automatically.", resultLabel: "Purchases", group: "conversion", defaultCallToAction: "shop_now" },
];

export function findObjectiveOption(objective: CampaignObjective): ObjectiveOption {
  return objectiveOptions.find((option) => option.objective === objective) ?? (objectiveOptions[0] as ObjectiveOption);
}

export const placementOptions: readonly { readonly placement: AdPlacement; readonly label: string; readonly description: string }[] = [
  { placement: "feed", label: "Home feed", description: "Sponsored post cards between posts. Only long or landscape videos play as video here." },
  { placement: "clips", label: "Reels", description: "Full-screen vertical clips inside the reels pager. Landscape videos get a View full screen button." },
  { placement: "stories", label: "Stories", description: "Full-screen between stories from people they follow." },
  { placement: "mart", label: "Marketplace grid & categories", description: "Product tiles marked Ad at fixed slots in Mart and category grids." },
  { placement: "search", label: "Marketplace search", description: "Product tiles marked Ad at fixed slots in search results." },
  { placement: "live", label: "Live discovery", description: "Promoted live streams in live discovery and as live cards in feed and reels." },
];

export const placementLabels: Record<AdPlacement, string> = Object.fromEntries(placementOptions.map((option) => [option.placement, option.label])) as Record<AdPlacement, string>;

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  rejected: "Rejected",
};

export const bidStrategyOptions: readonly { readonly type: BidStrategyType; readonly label: string; readonly description: string; readonly needsAmount: boolean }[] = [
  { type: "auto", label: "Highest volume (automatic)", description: "We bid to get the most results for your budget.", needsAmount: false },
  { type: "max_cpc", label: "Maximum cost per click", description: "Never pay more than this for a click.", needsAmount: true },
  { type: "max_cpm", label: "Maximum cost per 1,000 impressions", description: "Never pay more than this for 1,000 impressions.", needsAmount: true },
  { type: "target_cost", label: "Target cost per result", description: "Keep the average cost per result near this amount.", needsAmount: true },
];

export const callToActionLabels: Record<CallToAction, string> = {
  shop_now: "Shop now",
  learn_more: "Learn more",
  visit_store: "Visit store",
  send_message: "Send message",
  follow: "Follow",
  watch_more: "Watch more",
  order_now: "Order now",
  sign_up: "Sign up",
  install: "Install",
  download: "Download",
  book_now: "Book now",
  contact_us: "Contact us",
};

export const creativeTypeLabels: Record<CreativeType, { readonly label: string; readonly description: string }> = {
  single: { label: "Single image or video", description: "One image or video. You can make the media itself tappable." },
  carousel: { label: "Carousel", description: "2 to 10 swipeable cards, each with its own media, headline and link." },
  app_install: { label: "App install", description: "Promote your app with App Store and Google Play links." },
  promoted_post: { label: "Promoted post", description: "Boost an existing post. Tapping opens the post." },
};

export const creativeFormatLabels: Record<CreativeFormat, string> = {
  feed_post: "Feed post",
  clip: "Reel",
  product: "Marketplace product tile",
  store: "Store card",
  story: "Story",
  live: "Live card",
};

export const campaignNameMaximumLength = 120;
export const headlineMaximumLength = 60;
export const primaryTextMaximumLength = 500;
