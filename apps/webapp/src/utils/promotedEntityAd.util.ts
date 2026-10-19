import type { AdPromotedEntity, ProductSummary, SponsoredPlacement } from "@/types";
import type { MyStoreSummary } from "@/types/commerce.type";
import type { BoostDestination } from "@/utils/boostDestination.util";

const MAXIMUM_STORE_THUMBNAILS = 3;
const ROLES_THAT_CAN_PROMOTE_A_STORE = new Set(["owner", "manager"]);

export type PromotedEntitySponsoredPlacement = SponsoredPlacement & { readonly promoted: AdPromotedEntity };

export const isPromotedEntityAd = (sponsored: SponsoredPlacement | null | undefined): sponsored is PromotedEntitySponsoredPlacement =>
  Boolean(sponsored?.promoted && (sponsored.promoted.kind === "store" || sponsored.promoted.kind === "profile") && sponsored.promoted.id);

export const promotedEntityCallToActionLabel = (kind: AdPromotedEntity["kind"]): string => (kind === "store" ? "View store" : "View profile");

export function promotedEntityThumbnails(products: readonly Pick<ProductSummary, "imageUrl">[], bannerUrl: string | null): readonly string[] {
  const productImages = products.map((product) => product.imageUrl).filter((url): url is string => Boolean(url)).slice(0, MAXIMUM_STORE_THUMBNAILS);
  if (productImages.length >= 2) return productImages;
  return bannerUrl ? [bannerUrl] : productImages;
}

export function promoteHrefFor(destination: BoostDestination): string {
  const target = encodeURIComponent(destination.targetId);
  if (destination.type === "product") return `/ads/create?type=product&target=${target}`;
  return destination.type === "post" ? `/boost/${target}` : `/boost/${destination.type}/${target}`;
}

export function viewHrefForBoostDestination(destination: BoostDestination): string {
  const target = encodeURIComponent(destination.targetId);
  if (destination.type === "store") return `/store/${target}`;
  if (destination.type === "profile") return `/user/${target}`;
  if (destination.type === "product") return `/product/${target}`;
  return `/post/${target}`;
}

export function canPromoteStore(input: { readonly storeId: string; readonly storeOwnerUserId: string; readonly signedInUserId: string | undefined; readonly myStores: readonly MyStoreSummary[] | undefined }): boolean {
  if (!input.signedInUserId) return false;
  if (input.storeOwnerUserId === input.signedInUserId) return true;
  return Boolean(input.myStores?.some((store) => store.storeId === input.storeId && ROLES_THAT_CAN_PROMOTE_A_STORE.has(store.role)));
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
