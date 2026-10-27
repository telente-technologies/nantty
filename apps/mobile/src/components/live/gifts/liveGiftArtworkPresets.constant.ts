import type { LiveGiftGlyph } from "./liveGiftGlyphs.constant";

export type LiveGiftBespokeArtwork = "rose" | "galaxy";

export interface LiveGiftArtworkPreset {
  readonly glyph: LiveGiftGlyph;
  readonly gradient: readonly [string, string];
  readonly accent: string;
  readonly particleGlyph: LiveGiftGlyph;
  readonly bespoke?: LiveGiftBespokeArtwork;
}

const preset = (glyph: LiveGiftGlyph, from: string, to: string, accent: string, particleGlyph: LiveGiftGlyph = "sparkle", bespoke?: LiveGiftBespokeArtwork): LiveGiftArtworkPreset => ({
  glyph,
  gradient: [from, to],
  accent,
  particleGlyph,
  bespoke,
});

export const LIVE_GIFT_ARTWORK_PRESETS: Readonly<Record<string, LiveGiftArtworkPreset>> = {
  "like-v1": preset("heart", "#FF8FB1", "#FF2D6F", "#FF5C8D", "heart"),
  "clap-v1": preset("clap", "#FFD27A", "#F29A00", "#FFC233"),
  "fire-v1": preset("flame", "#FFD24D", "#FF4D00", "#FF7A1A", "flame"),
  "heart-v1": preset("heart", "#FF5E7E", "#C8002C", "#FF4D6D", "heart"),
  "star-v1": preset("star", "#FFF0A0", "#E0A100", "#FFD34D", "star"),
  "thumbs-up-v1": preset("thumb", "#7CC4FF", "#1F6FE5", "#4DA3FF"),
  "smile-v1": preset("smile", "#FFE680", "#F5B400", "#FFD34D"),
  "sparkle-v1": preset("sparkle", "#FFFFFF", "#B69CFF", "#D9CCFF"),
  "rose-v2": preset("heart", "#FF6B81", "#B3001B", "#FF4D6D", "heart", "rose"),
  "gift-box-v1": preset("giftBox", "#FF7AD9", "#9B2CFF", "#E066FF"),
  "crown-v1": preset("crown", "#FFE680", "#D49A00", "#FFD34D", "star"),
  "diamond-v1": preset("diamond", "#C9F6FF", "#2BA8FF", "#7FDBFF", "diamond"),
  "rocket-v2": preset("rocket", "#FFFFFF", "#8A9BB8", "#FF7A1A", "flame"),
  "lightning-v1": preset("bolt", "#FFF7A0", "#FFB800", "#FFE14D", "bolt"),
  "fireworks-v1": preset("firework", "#FF5CA8", "#FFD34D", "#FF5CA8", "star"),
  "money-rain-v1": preset("coin", "#FFE680", "#C98F00", "#FFD34D", "coin"),
  "golden-crown-v1": preset("crown", "#FFF3B0", "#B87900", "#FFC233", "star"),
  "luxury-car-v1": preset("car", "#FF6B6B", "#9E0000", "#FFD34D", "sparkle"),
  "private-jet-v1": preset("jet", "#FFFFFF", "#7A8CA8", "#7FDBFF", "sparkle"),
  "treasure-chest-v1": preset("chest", "#D9893D", "#7A3F00", "#FFD34D", "coin"),
  "diamond-shower-v1": preset("diamond", "#E6FBFF", "#3D8BFF", "#7FDBFF", "diamond"),
  "golden-rain-v1": preset("coin", "#FFF3B0", "#D49A00", "#FFD34D", "coin"),
  "supernova-v1": preset("sparkle", "#FFFFFF", "#FF7A1A", "#FFB547", "star"),
  "nantty-galaxy-v1": preset("sparkle", "#B69CFF", "#4B1FA8", "#B69CFF", "star", "galaxy"),
  "nantty-king-v1": preset("crown", "#FFF3B0", "#B87900", "#FFC233", "crown"),
  "nantty-empire-v1": preset("castle", "#FFE680", "#8A5A00", "#FFD34D", "star"),
};

const FALLBACK_ARTWORK_PRESET = preset("giftBox", "#FF7AD9", "#9B2CFF", "#E066FF");

export const findLiveGiftArtworkPreset = (assetKey: string | null | undefined) =>
  (assetKey ? LIVE_GIFT_ARTWORK_PRESETS[assetKey] : undefined) ?? FALLBACK_ARTWORK_PRESET;
