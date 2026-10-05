import type { Icon as PhosphorGlyph, IconWeight } from "phosphor-react-native";
import { StyleSheet, View } from "react-native";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "./icon.types";

export const DEFAULT_ICON_WEIGHT: IconWeight = "bold";

interface GlyphSpec {
  readonly weight?: IconWeight;
  readonly ink?: string;
  readonly width?: number;
  readonly height?: number;
  readonly glyph?: number;
}

export function phosphorIcon(Glyph: PhosphorGlyph, spec: GlyphSpec = {}) {
  const { weight = DEFAULT_ICON_WEIGHT, ink = "#000000", width = 24, height = width, glyph = Math.min(width, height) } = spec;
  const padded = width !== glyph || height !== glyph;
  return function PhosphorIcon({ size, color, style }: IconProps) {
    const themedInk = useThemedIconInk(ink);
    const scale = size === undefined ? 1 : size / width;
    if (!padded) return <Glyph size={glyph * scale} color={color ?? themedInk} weight={weight} style={style} />;
    return (
      <View style={[{ width: width * scale, height: height * scale, alignItems: "center", justifyContent: "center" }, style]}>
        <Glyph size={glyph * scale} color={color ?? themedInk} weight={weight} />
      </View>
    );
  };
}

interface BadgeSpec {
  readonly box: number;
  readonly radius: number;
  readonly fill: string;
  readonly fillOpacity?: number;
  readonly glyph: number;
  readonly glyphInk: string;
  readonly weight?: IconWeight;
  readonly tintGlyph?: boolean;
}

export function phosphorBadgeIcon(Glyph: PhosphorGlyph, spec: BadgeSpec) {
  const { box, radius, fill, fillOpacity = 1, glyph, glyphInk, weight = DEFAULT_ICON_WEIGHT, tintGlyph = false } = spec;
  return function PhosphorBadgeIcon({ size, color, style }: IconProps) {
    const themedFill = useThemedIconInk(fill);
    const themedGlyphInk = useThemedIconInk(glyphInk);
    const scale = size === undefined ? 1 : size / box;
    return (
      <View style={[{ width: box * scale, height: box * scale, alignItems: "center", justifyContent: "center" }, style]}>
        <View style={[StyleSheet.absoluteFill, { borderRadius: radius * scale, backgroundColor: color ?? themedFill, opacity: fillOpacity }]} />
        <Glyph size={glyph * scale} color={tintGlyph ? (color ?? themedGlyphInk) : themedGlyphInk} weight={weight} />
      </View>
    );
  };
}
