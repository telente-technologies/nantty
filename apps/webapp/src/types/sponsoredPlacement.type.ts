import type { AdAppInstall, AdCard, AdClickLinks, AdCreativeType, AdDestination, AdPromotedEntity } from "./adCreative.type";
import type { ID } from "./primitive.type";

export interface SponsoredPlacement {
  readonly campaignId: ID;
  readonly label: "Sponsored" | "Promoted" | "Boosted";
  readonly advertiserName: string;
  readonly ctaLabel?: string;
  readonly ctaUrl?: string;
  readonly adType?: AdCreativeType;
  readonly impressionToken?: string;
  readonly clickLinks?: AdClickLinks;
  readonly destination?: AdDestination;
  readonly mediaClickable?: boolean;
  readonly cards?: readonly AdCard[];
  readonly app?: AdAppInstall;
  readonly promoted?: AdPromotedEntity;
}
