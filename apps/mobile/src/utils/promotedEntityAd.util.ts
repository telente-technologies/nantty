import type { AdPromotedEntity, ProductSummary, SponsoredPlacement } from "@/types";

const MAXIMUM_STORE_THUMBNAILS = 3;

export type PromotedEntitySponsoredPlacement = SponsoredPlacement & { readonly promoted: AdPromotedEntity };

export const isPromotedEntityAd = (sponsored: SponsoredPlacement | null | undefined): sponsored is PromotedEntitySponsoredPlacement =>
  Boolean(sponsored?.promoted && (sponsored.promoted.kind === "store" || sponsored.promoted.kind === "profile") && sponsored.promoted.id);

export const promotedEntityCallToActionLabel = (kind: AdPromotedEntity["kind"]): string => (kind === "store" ? "View store" : "View profile");

export function promotedEntityThumbnails(products: readonly Pick<ProductSummary, "imageUrl">[], bannerUrl: string | null): readonly string[] {
  const productImages = products.map((product) => product.imageUrl).filter((url): url is string => Boolean(url)).slice(0, MAXIMUM_STORE_THUMBNAILS);
  if (productImages.length >= 2) return productImages;
  return bannerUrl ? [bannerUrl] : productImages;
}

export type PromotedCheckmarkColor = "blue" | "gold" | "black";

const CHECKMARK_COLORS: readonly PromotedCheckmarkColor[] = ["blue", "gold", "black"];

export function promotedCheckmarkColor(promoted: AdPromotedEntity, verification: { readonly badgeVisible?: boolean; readonly color?: string } | null | undefined): PromotedCheckmarkColor | null {
  if (verification?.badgeVisible && CHECKMARK_COLORS.includes(verification.color as PromotedCheckmarkColor)) return verification.color as PromotedCheckmarkColor;
  if (CHECKMARK_COLORS.includes(promoted.checkmarkColor as PromotedCheckmarkColor)) return promoted.checkmarkColor as PromotedCheckmarkColor;
  if (!promoted.verified) return null;
  return promoted.kind === "store" ? "gold" : "blue";
}

export const resolvePromotedFollowState = (user: { readonly followState?: string; readonly isFollowing?: boolean } | undefined): "none" | "requested" | "accepted" | "rejected" | "blocked" => {
  if (user?.followState === "requested" || user?.followState === "accepted" || user?.followState === "rejected" || user?.followState === "blocked") return user.followState;
  return user?.isFollowing ? "accepted" : "none";
};
