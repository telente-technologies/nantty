import { StyleSheet, View } from "react-native";

export const CLIP_LOOKS = ["none", "warm", "cool", "rose", "aqua", "sunset"] as const;

export type ClipLookId = (typeof CLIP_LOOKS)[number];

export const CLIP_LOOK_LABELS: Record<ClipLookId, string> = {
  none: "None",
  warm: "Warm",
  cool: "Cool",
  rose: "Rosé",
  aqua: "Aqua",
  sunset: "Sunset",
};

const LOOK_OVERLAYS: Record<Exclude<ClipLookId, "none">, readonly string[]> = {
  warm: ["rgba(255, 166, 60, 0.14)"],
  cool: ["rgba(70, 140, 255, 0.14)"],
  rose: ["rgba(255, 110, 160, 0.14)"],
  aqua: ["rgba(45, 200, 190, 0.14)"],
  sunset: ["rgba(255, 90, 40, 0.10)", "rgba(120, 40, 160, 0.08)"],
};

export function isClipLookId(value: unknown): value is ClipLookId {
  return typeof value === "string" && (CLIP_LOOKS as readonly string[]).includes(value);
}

export function ClipLookOverlay({ look }: { readonly look: ClipLookId | null | undefined }) {
  if (!look || look === "none") return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {LOOK_OVERLAYS[look].map((backgroundColor, index) => (
        <View key={index} pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor }]} />
      ))}
    </View>
  );
}
