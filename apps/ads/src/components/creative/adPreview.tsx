"use client";

import { useState } from "react";

import { BlockedPlacementNotice, LiveCardPreview, LiveDiscoveryPreview, MarketplaceGridPreview } from "@/components/creative/adPreviewMarketplaceAndLive";
import { CommentThreadPreview } from "@/components/creative/adPreviewRichFormats";
import { ClipPreview, FeedCardPreview, StoreCardPreview } from "@/components/creative/adPreviewFormats";
import { SegmentedControl } from "@/components/ui/formFields";
import { placementLabels } from "@/constants/campaignOptions.constant";
import type { AdPlacement } from "@/types/campaign.type";
import type { Creative } from "@/types/creative.type";
import { checkCreativeFitForPlacement, type CreativeShape } from "@/utils/adPlacementRules.util";

import styles from "./adPreview.module.css";

export type PreviewSurface = "feed" | "comments" | "reels" | "stories" | "marketplace" | "search" | "live";

const surfaceLabels: Record<PreviewSurface, string> = { feed: "Feed", comments: "Comments", reels: "Reels", stories: "Stories", marketplace: "Marketplace", search: "Search", live: "Live" };
const placementBySurface: Record<PreviewSurface, AdPlacement> = { feed: "feed", comments: "feed", reels: "clips", stories: "stories", marketplace: "mart", search: "search", live: "live" };
const surfaceByPlacement: Record<AdPlacement, PreviewSurface> = { feed: "feed", clips: "reels", stories: "stories", mart: "marketplace", search: "search", live: "live" };
const surfaceOrder: readonly PreviewSurface[] = ["feed", "comments", "reels", "marketplace", "search", "live", "stories"];

export function buildCreativeShapeFromCreative(creative: Creative): CreativeShape {
  return { creativeType: creative.type, sourceType: creative.source.type, media: creative.type === "carousel" ? (creative.cards ?? []).map((card) => card.media) : creative.media, hasProduct: Boolean(creative.product), hasLiveStream: Boolean(creative.live) };
}

function chooseNaturalSurfaceForCreative(creative: Creative): PreviewSurface {
  if (creative.live) return "live";
  if (creative.format === "clip") return "reels";
  if (creative.format === "story") return "stories";
  if (creative.format === "product") return "marketplace";
  return "feed";
}

function renderCreativeOnSurface(creative: Creative, surface: PreviewSurface) {
  const fit = checkCreativeFitForPlacement(buildCreativeShapeFromCreative(creative), placementBySurface[surface]);
  if (fit.status === "blocked" && creative.media.length > 0) return <BlockedPlacementNotice placementLabel={placementLabels[placementBySurface[surface]]} reason={fit.message} />;
  if (surface === "comments") return <CommentThreadPreview creative={creative} />;
  if (surface === "reels") return <ClipPreview creative={creative} variant="clip" />;
  if (surface === "stories") return <ClipPreview creative={creative} variant="story" />;
  if (surface === "marketplace" || surface === "search") return <MarketplaceGridPreview creative={creative} context={surface === "search" ? "search" : "mart"} />;
  if (surface === "live") return creative.live ? <LiveDiscoveryPreview creative={creative} /> : <LiveCardPreview creative={creative} variant="feed" />;
  if (creative.format === "store" && !creative.live) return <StoreCardPreview creative={creative} />;
  return <FeedCardPreview creative={creative} />;
}

export function AdPreview({ creative, placement }: { readonly creative: Creative; readonly placement?: AdPlacement }) {
  const surface = placement ? surfaceByPlacement[placement] : chooseNaturalSurfaceForCreative(creative);
  return <div className={styles.phoneFrame}>{renderCreativeOnSurface(creative, surface)}</div>;
}

export function AdPreviewWithSurfaceSwitcher({ creative, availablePlacements }: { readonly creative: Creative; readonly availablePlacements?: readonly AdPlacement[] }) {
  const availableSurfaces = surfaceOrder.filter((surface) => !availablePlacements || availablePlacements.includes(placementBySurface[surface]));
  const [chosenSurface, setChosenSurface] = useState<PreviewSurface>(() => chooseNaturalSurfaceForCreative(creative));
  const surface = availableSurfaces.includes(chosenSurface) ? chosenSurface : (availableSurfaces[0] ?? "feed");
  return (
    <div className={styles.switcher}>
      {availableSurfaces.length > 1 ? <SegmentedControl label="Preview placement" value={surface} onValueChange={setChosenSurface} options={availableSurfaces.map((value) => ({ value, label: surfaceLabels[value] }))} /> : null}
      <div className={styles.phoneFrame}>{renderCreativeOnSurface(creative, surface)}</div>
    </div>
  );
}
