export interface ExternalShareCard {
  readonly availability: "available" | "private" | "unavailable" | "not_in_region";
  readonly title: string | null;
  readonly subtitle: string | null;
  readonly imageUrl: string | null;
  readonly priceLabel?: string | null;
  readonly stock?: number | null;
  readonly isLive?: boolean;
  readonly viewerCount?: number | null;
}

export interface ShareCardResolver {
  resolve(kind: "product" | "store" | "live", id: string, viewerId: string): Promise<ExternalShareCard | null>;
}
