import type { Prisma } from "../../../generated/prisma/client.js";

export type MediaAssetWithVariants = Prisma.MediaAssetGetPayload<{ include: { variants: true } }>;

export interface MediaVariantView {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly bitrateKbps?: number;
}

export interface MediaAssetView {
  readonly id: string;
  readonly type: "image" | "video" | "audio" | "document";
  readonly status: "processing" | "ready" | "failed";
  readonly purpose: string;
  readonly width: number;
  readonly height: number;
  readonly durationSeconds?: number;
  readonly pageCount?: number;
  readonly blurhash?: string;
  readonly posterUrl?: string;
  readonly hlsUrl?: string;
  readonly variants: readonly MediaVariantView[];
  readonly failureReason?: string;
  readonly failureHint?: string;
}
