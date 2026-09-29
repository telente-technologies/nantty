import type { AdPlacement } from "@/types/campaign.type";

export type AdFormatGroup = "marketplace" | "feed" | "reels" | "live";

export interface AdFormatGroupOption {
  readonly group: AdFormatGroup;
  readonly label: string;
  readonly description: string;
  readonly placements: readonly AdPlacement[];
  readonly creativeGuidance: string;
}

export const adFormatGroups: readonly AdFormatGroupOption[] = [
  { group: "marketplace", label: "Marketplace", description: "Sponsored product tiles in Mart grids, categories and search, marked Ad and placed at fixed slots.", placements: ["mart", "search"], creativeGuidance: "Promote a product. Square photo, product title and price." },
  { group: "feed", label: "Feed", description: "Sponsored post cards in the home feed. Short vertical videos run in Reels instead.", placements: ["feed"], creativeGuidance: "Images 4:5 to 1.91:1. Videos play in the feed only when landscape or at least 60 seconds." },
  { group: "reels", label: "Reels", description: "Promoted clips full-screen in the reels pager and between stories.", placements: ["clips", "stories"], creativeGuidance: "Vertical 9:16 video, 3–90 seconds. Landscape videos show a View full screen button." },
  { group: "live", label: "Live", description: "Promoted live streams in live discovery and as live cards in feed and reels.", placements: ["live"], creativeGuidance: "Promote a scheduled or ongoing live session from your profile." },
];

export function findFormatGroupForPlacement(placement: AdPlacement): AdFormatGroupOption {
  return adFormatGroups.find((option) => option.placements.includes(placement)) ?? (adFormatGroups[1] as AdFormatGroupOption);
}

export const marketplaceAdSlotPositions: readonly number[] = [2, 7, 12, 19];
