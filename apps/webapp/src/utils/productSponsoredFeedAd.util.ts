import type { SponsoredPlacement } from "@/types";

export function isProductSponsoredFeedAd(sponsored: SponsoredPlacement | null | undefined): sponsored is SponsoredPlacement & { readonly destination: { readonly type: "product"; readonly targetId: string } } {
  return sponsored?.destination?.type === "product" && typeof sponsored.destination.targetId === "string" && sponsored.destination.targetId.length > 0;
}
