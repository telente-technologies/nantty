import type { SponsoredSurface } from "../../../interfaces/discovery.interface.js";
import type { IntelligenceAdCreative, IntelligenceAdPlacement, IntelligenceAspectRatio } from "../../intelligence/models/intelligenceAds.model.js";
import type { AdPlacement, CreativeMedia, CreativeSourceType, ResolvedCreative } from "../models/adCampaigns.model.js";

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
}

export const FEED_VIDEO_MINIMUM_SECONDS_WHEN_VERTICAL = 60;
export const REEL_MINIMUM_SECONDS = 3;
export const REEL_MAXIMUM_SECONDS_WHEN_VERTICAL = 90;
export const REEL_MAXIMUM_SECONDS_WHEN_LANDSCAPE = 600;

const PLACEMENT_LABELS: Readonly<Record<AdPlacement, string>> = { feed: "Feed", clips: "Reels", mart: "Mart", search: "Search", stories: "Stories", live: "Live" };

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
  if (firstMedia === undefined) return { status: "blocked", message: "Add an image or video." };
  if (firstMedia.kind === "video") {
    if (isLandscapeMedia(firstMedia)) return { status: "ready", message: "Landscape video plays in the feed." };
    if ((firstMedia.durationSeconds ?? 0) >= FEED_VIDEO_MINIMUM_SECONDS_WHEN_VERTICAL) return { status: "ready", message: "Long video plays in the feed." };
    return { status: "blocked", message: `Short vertical videos do not play in the feed. They run in Reels; use a landscape video or one of at least ${FEED_VIDEO_MINIMUM_SECONDS_WHEN_VERTICAL} seconds for the feed.` };
  }
  const ratio = readAspectRatio(firstMedia);
  if (ratio < 0.8 || ratio > 1.91) return { status: "adjusted", message: "The image is outside 4:5 – 1.91:1 and will be cropped to 4:5." };
  return { status: "ready", message: "Post card with your image and button." };
}

function checkReelFit(shape: CreativeShape, firstMedia: CreativeMedia | undefined, placement: "clips" | "stories"): Omit<PlacementFit, "placement"> {
  if (shape.hasLiveStream) {
    return placement === "clips" ? { status: "ready", message: "Shows as a full-screen live card between reels." } : { status: "blocked", message: "Live streams are not shown between stories." };
  }
  if (firstMedia === undefined) return { status: "blocked", message: "Add a video." };
  if (placement === "stories" && firstMedia.kind === "image") {
    return isVerticalMedia(firstMedia) ? { status: "ready", message: "Full-screen story image." } : { status: "adjusted", message: "Shown on a blurred background because the image is not vertical." };
  }
  if (firstMedia.kind !== "video") return { status: "blocked", message: "Reels need a video. Choose a clip or upload a video." };
  const duration = firstMedia.durationSeconds ?? 0;
  if (duration > 0 && duration < REEL_MINIMUM_SECONDS) return { status: "blocked", message: `Videos in Reels must be at least ${REEL_MINIMUM_SECONDS} seconds.` };
  if (isLandscapeMedia(firstMedia)) {
    if (duration > REEL_MAXIMUM_SECONDS_WHEN_LANDSCAPE) return { status: "blocked", message: "Landscape videos in Reels can be at most 10 minutes." };
    return { status: "adjusted", message: "Landscape video: letterboxed with a View full screen button." };
  }
  if (duration > REEL_MAXIMUM_SECONDS_WHEN_VERTICAL) return { status: "blocked", message: `Vertical videos in Reels can be at most ${REEL_MAXIMUM_SECONDS_WHEN_VERTICAL} seconds.` };
  if (!isVerticalMedia(firstMedia)) return { status: "adjusted", message: "Square video is shown with bars top and bottom. 9:16 fills the screen." };
  return { status: "ready", message: "Full-screen vertical video." };
}

export function checkCreativeFitForPlacement(shape: CreativeShape, placement: AdPlacement): PlacementFit {
  const firstMedia = shape.media[0];
  if (placement === "mart" || placement === "search") {
    return shape.hasProduct
      ? { placement, status: "ready", message: "Product tile marked Ad at a fixed grid slot." }
      : { placement, status: "blocked", message: "Marketplace ads are product tiles. Promote a product." };
  }
  if (placement === "live") {
    return shape.hasLiveStream
      ? { placement, status: "ready", message: "Promoted in live discovery." }
      : { placement, status: "blocked", message: "Live placements promote a live stream. Choose a live session." };
  }
  return { placement, ...(placement === "feed" ? checkFeedFit(shape, firstMedia) : checkReelFit(shape, firstMedia, placement)) };
}

export function describeCreativeShape(creative: ResolvedCreative): CreativeShape {
  return { sourceType: creative.source.type, media: creative.media, hasProduct: creative.product !== null, hasLiveStream: creative.live !== null };
}

export function listPlacementsWhereCreativeCanRun(shape: CreativeShape, placements: readonly AdPlacement[]): AdPlacement[] {
  return placements.filter((placement) => checkCreativeFitForPlacement(shape, placement).status !== "blocked");
}

export function describeWhyCreativeCannotRunAnywhere(shape: CreativeShape, placements: readonly AdPlacement[]): string | null {
  const fits = placements.map((placement) => checkCreativeFitForPlacement(shape, placement));
  if (fits.some((fit) => fit.status !== "blocked")) return null;
  const firstBlocked = fits[0];
  return firstBlocked === undefined ? "Choose at least one placement." : `This ad cannot run in any chosen placement. ${PLACEMENT_LABELS[firstBlocked.placement]}: ${firstBlocked.message}`;
}

export function convertPlacementForIntelligence(placement: AdPlacement): IntelligenceAdPlacement {
  return placement === "live" ? "live_discovery" : placement;
}

export function convertSurfaceToPlacement(surface: SponsoredSurface): AdPlacement {
  return surface;
}

function classifyAspectRatio(media: CreativeMedia | undefined): IntelligenceAspectRatio {
  if (media === undefined) return "1:1";
  const ratio = readAspectRatio(media);
  const options: readonly [IntelligenceAspectRatio, number][] = [["9:16", 9 / 16], ["4:5", 0.8], ["1:1", 1], ["16:9", 16 / 9]];
  return options.reduce((best, option) => (Math.abs(option[1] - ratio) < Math.abs(best[1] - ratio) ? option : best))[0];
}

export function describeCreativeForIntelligence(creative: ResolvedCreative, placement: AdPlacement): IntelligenceAdCreative {
  const firstMedia = creative.media[0];
  const isProductTile = (placement === "mart" || placement === "search") && creative.product !== null;
  const mediaType = creative.live !== null
    ? "live_stream"
    : isProductTile
      ? "product_tile"
      : creative.media.length > 1
        ? "carousel"
        : firstMedia?.kind === "video" ? "video" : "image";
  return {
    mediaType,
    aspectRatio: isProductTile ? "1:1" : classifyAspectRatio(firstMedia),
    durationMs: mediaType === "video" && firstMedia?.durationSeconds !== null && firstMedia?.durationSeconds !== undefined ? Math.round(firstMedia.durationSeconds * 1000) : null,
    isLiveNow: creative.live?.status === "live",
    productId: creative.product?.productId ?? null,
    liveStreamId: creative.live?.liveSessionId ?? null,
  };
}
