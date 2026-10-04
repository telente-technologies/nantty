import type { ID } from "./models.type";

export type AdCreativeType = "single" | "carousel" | "app_install" | "promoted_post";
export type AdPlatform = "ios" | "android" | "web";

export interface AdDestination {
  readonly type: "url" | "post" | "product" | "store" | "profile" | "messages" | "app_store";
  readonly targetId?: ID | null;
  readonly url?: string | null;
}

export interface AdCardMedia {
  readonly kind: "image" | "video";
  readonly url: string;
  readonly posterUrl?: string | null;
  readonly width?: number;
  readonly height?: number;
}

export interface AdCard {
  readonly media: AdCardMedia;
  readonly headline: string;
  readonly description?: string;
  readonly ctaLabel?: string;
  readonly destination: AdDestination;
}

export interface AdAppInstall {
  readonly appName: string;
  readonly iconUrl?: string | null;
  readonly rating?: number | null;
  readonly iosStoreUrl: string;
  readonly androidStoreUrl: string;
  readonly webFallbackUrl: string;
  readonly iosDeepLink: string;
  readonly androidDeepLink: string;
}

export interface AdClickLinks {
  readonly media?: string;
  readonly cta?: string;
  readonly cards?: readonly string[];
}

export type AdTapTarget = { readonly kind: "cta" } | { readonly kind: "media" } | { readonly kind: "card"; readonly index: number };

export type AdTapAction =
  | { readonly kind: "internal"; readonly route: "PostDetail" | "ProductDetail" | "Store" | "UserProfile" | "Messages"; readonly params: Record<string, string> | undefined }
  | { readonly kind: "external"; readonly url: string }
  | { readonly kind: "install"; readonly url: string; readonly deepLink: string | null }
  | { readonly kind: "none" };
