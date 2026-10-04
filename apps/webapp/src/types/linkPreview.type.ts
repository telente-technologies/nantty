export interface LinkPreview {
  readonly url: string;
  readonly domain: string;
  readonly title: string;
  readonly description: string | null;
  readonly siteName: string | null;
  readonly imageUrl: string | null;
  readonly imageMediaId?: string | null;
}

export type InternalLinkKind = "product" | "store" | "profile" | "live" | "post";

export interface InternalLinkReference {
  readonly kind: InternalLinkKind;
  readonly id: string;
}
