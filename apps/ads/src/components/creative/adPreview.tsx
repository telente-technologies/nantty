"use client";

import { useState } from "react";

import { ClipPreview, FeedCardPreview, ProductTilePreview, StoreCardPreview } from "@/components/creative/adPreviewFormats";
import { SegmentedControl } from "@/components/ui/formFields";
import type { AdPlacement } from "@/types/campaign.type";
import type { Creative } from "@/types/creative.type";

import styles from "./adPreview.module.css";

export type PreviewSurface = "feed" | "clips" | "mart" | "stories";

const surfaceOptions: readonly { readonly value: PreviewSurface; readonly label: string }[] = [
  { value: "feed", label: "Feed" },
  { value: "clips", label: "Clips" },
  { value: "mart", label: "Mart" },
  { value: "stories", label: "Stories" },
];

function chooseSurfaceForPlacement(creative: Creative, placement: AdPlacement | undefined): PreviewSurface {
  if (placement === "clips" || placement === "stories" || placement === "mart") return placement;
  if (placement === "feed" || placement === "search" || placement === "live") return "feed";
  if (creative.format === "clip") return "clips";
  if (creative.format === "story") return "stories";
  if (creative.format === "product") return "mart";
  return "feed";
}

function renderCreativeOnSurface(creative: Creative, surface: PreviewSurface) {
  if (surface === "clips") return <ClipPreview creative={creative} variant="clip" />;
  if (surface === "stories") return <ClipPreview creative={creative} variant="story" />;
  if (surface === "mart") return <ProductTilePreview creative={creative} />;
  if (creative.format === "store") return <StoreCardPreview creative={creative} />;
  return <FeedCardPreview creative={creative} />;
}

export function AdPreview({ creative, placement }: { readonly creative: Creative; readonly placement?: AdPlacement }) {
  return <div className={styles.phoneFrame}>{renderCreativeOnSurface(creative, chooseSurfaceForPlacement(creative, placement))}</div>;
}

export function AdPreviewWithSurfaceSwitcher({ creative, availablePlacements }: { readonly creative: Creative; readonly availablePlacements?: readonly AdPlacement[] }) {
  const [surface, setSurface] = useState<PreviewSurface>(() => chooseSurfaceForPlacement(creative, undefined));
  const options = availablePlacements ? surfaceOptions.filter((option) => option.value === "feed" || availablePlacements.includes(option.value)) : surfaceOptions;
  return (
    <div className={styles.switcher}>
      <SegmentedControl label="Preview placement" value={surface} onValueChange={setSurface} options={options} />
      <div className={styles.phoneFrame}>{renderCreativeOnSurface(creative, surface)}</div>
    </div>
  );
}
