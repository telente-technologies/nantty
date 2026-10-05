import type { ProductCollection } from "./commerce.type";
import type { ID } from "./models.type";

export type MartHighlightKind = "deals_of_the_day" | "featured_brands" | "new_arrivals" | "category_spotlight" | "trending";

export type MartHighlightReasonCode = "time_sensitive" | "followed_brands" | "fresh_listings" | "browsing_history" | "trending_nearby";

export type MartHighlightTarget =
  | { readonly type: "collection"; readonly collection: ProductCollection; readonly name: string }
  | { readonly type: "category"; readonly categoryId: ID; readonly name: string };

export interface MartHighlight {
  readonly id: ID;
  readonly kind: MartHighlightKind;
  readonly title: string;
  readonly subtitle: string | null;
  readonly imageUrl: string | null;
  readonly target: MartHighlightTarget;
  readonly ranking: { readonly score: number; readonly reason: { readonly code: MartHighlightReasonCode; readonly label: string } };
}
