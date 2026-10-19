import { placementLabels } from "@/constants/campaignOptions.constant";
import type { AdPlacement } from "@/types/campaign.type";
import type { CreativeMedia, CreativeSourceType, CreativeType } from "@/types/creative.type";

export type PlacementFitStatus = "ready" | "adjusted" | "blocked";

export interface PlacementFit {
  readonly placement: AdPlacement;
  readonly status: PlacementFitStatus;
  readonly message: string;
}

export interface CreativeShape {
  readonly sourceType: CreativeSourceType;
  readonly media: readonly CreativeMedia[];
  readonly hasProduct: boolean;
  readonly hasLiveStream: boolean;
  readonly creativeType?: CreativeType;
}

export const feedVideoMinimumSecondsWhenVertical = 60;
export const reelMinimumSeconds = 3;
export const reelMaximumSecondsWhenVertical = 90;
export const reelMaximumSecondsWhenLandscape = 600;

function readAspectRatio(media: CreativeMedia): number {
  return media.height > 0 ? media.width / media.height : 1;
}

export function isLandscapeMedia(media: CreativeMedia): boolean {
  return readAspectRatio(media) > 1.05;
}

export function isVerticalMedia(media: CreativeMedia): boolean {
  return readAspectRatio(media) < 0.8;
}

function checkFeedFit(shape: CreativeShape, firstMedia: CreativeMedia | undefined): Omit<PlacementFit, "placement"> {
  if (shape.hasLiveStream) return { status: "ready", message: "Shows as a live card in the feed." };
  if (!firstMedia) return { status: "blocked", message: "Add an image or video." };
  if (firstMedia.kind === "video") {
    const duration = firstMedia.durationSeconds ?? 0;
    if (isLandscapeMedia(firstMedia)) return { status: "ready", message: "Landscape video plays in the feed." };
    if (duration >= feedVideoMinimumSecondsWhenVertical) return { status: "ready", message: "Long video plays in the feed." };
    return { status: "blocked", message: `Short vertical videos do not play in the feed. They run in Reels; use a landscape video or one of at least ${feedVideoMinimumSecondsWhenVertical} seconds for the feed.` };
  }
  const ratio = readAspectRatio(firstMedia);
  if (ratio < 0.8 || ratio > 1.91) return { status: "adjusted", message: "The image is outside 4:5 – 1.91:1 and will be cropped to 4:5." };
  return { status: "ready", message: "Post card with your image and button." };
}

function checkReelFit(shape: CreativeShape, firstMedia: CreativeMedia | undefined, placement: "clips" | "stories"): Omit<PlacementFit, "placement"> {
  if (shape.hasLiveStream) return placement === "clips" ? { status: "ready", message: "Shows as a full-screen live card between reels." } : { status: "blocked", message: "Live streams are not shown between stories." };
  if (!firstMedia) return { status: "blocked", message: "Add a video." };
  if (placement === "stories" && firstMedia.kind === "image") return isVerticalMedia(firstMedia) ? { status: "ready", message: "Full-screen story image." } : { status: "adjusted", message: "Shown on a blurred background because the image is not vertical." };
  if (firstMedia.kind !== "video") return { status: "blocked", message: "Reels need a video. Choose a clip or upload a video." };
  const duration = firstMedia.durationSeconds ?? 0;
  if (duration > 0 && duration < reelMinimumSeconds) return { status: "blocked", message: `Videos in Reels must be at least ${reelMinimumSeconds} seconds.` };
  if (isLandscapeMedia(firstMedia)) {
    if (duration > reelMaximumSecondsWhenLandscape) return { status: "blocked", message: "Landscape videos in Reels can be at most 10 minutes." };
    return { status: "adjusted", message: "Landscape video: letterboxed with a View full screen button." };
  }
  if (duration > reelMaximumSecondsWhenVertical) return { status: "blocked", message: `Vertical videos in Reels can be at most ${reelMaximumSecondsWhenVertical} seconds.` };
  if (!isVerticalMedia(firstMedia)) return { status: "adjusted", message: "Square video is shown with bars top and bottom. 9:16 fills the screen." };
  return { status: "ready", message: "Full-screen vertical video." };
}

export function checkCreativeFitForPlacement(shape: CreativeShape, placement: AdPlacement): PlacementFit {
  const firstMedia = shape.media[0];
  let fit: Omit<PlacementFit, "placement">;
  if (shape.creativeType === "carousel" && placement !== "feed") {
    fit = { status: "blocked", message: "Carousels run in the feed and the comment thread only." };
  } else if (shape.sourceType === "store") {
    fit = placement === "feed" ? { status: "ready", message: "Store card with your logo, name and button, in the feed and comment threads." } : { status: "blocked", message: "Store ads run in the feed and the comment thread only for now." };
  } else if (shape.creativeType === "app_install" && (placement === "mart" || placement === "search" || placement === "live")) {
    fit = { status: "blocked", message: "App install ads run in the feed, Reels and stories, not in product grids or live." };
  } else if (placement === "mart" || placement === "search") {
    fit = shape.hasProduct ? { status: "ready", message: "Product tile marked Ad at a fixed grid slot." } : { status: "blocked", message: "Marketplace ads are product tiles. Promote a product." };
  } else if (placement === "live") {
    fit = shape.hasLiveStream ? { status: "ready", message: "Promoted in live discovery." } : { status: "blocked", message: "Live placements promote a live stream. Choose a live session." };
  } else if (placement === "feed") {
    fit = checkFeedFit(shape, firstMedia);
  } else {
    fit = checkReelFit(shape, firstMedia, placement);
  }
  return { placement, ...fit };
}

export function checkCreativeFitForEveryPlacement(shape: CreativeShape, placements: readonly AdPlacement[]): PlacementFit[] {
  return placements.map((placement) => checkCreativeFitForPlacement(shape, placement));
}

export function listPlacementsWhereCreativeCanRun(shape: CreativeShape, placements: readonly AdPlacement[]): AdPlacement[] {
  return checkCreativeFitForEveryPlacement(shape, placements).filter((fit) => fit.status !== "blocked").map((fit) => fit.placement);
}

export function describeWhyCreativeCannotRunAnywhere(shape: CreativeShape, placements: readonly AdPlacement[]): string | null {
  const fits = checkCreativeFitForEveryPlacement(shape, placements);
  if (fits.some((fit) => fit.status !== "blocked")) return null;
  const firstBlocked = fits[0];
  return firstBlocked ? `This ad cannot run in any chosen placement. ${placementLabels[firstBlocked.placement]}: ${firstBlocked.message}` : "Choose at least one placement.";
}
