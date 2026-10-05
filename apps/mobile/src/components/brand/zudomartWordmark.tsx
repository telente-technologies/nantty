import { defaultZudomartWordmarkVariant, zudomartSymbolPath, zudomartSymbolTileRadius, zudomartSymbolViewBox, zudomartWordmarkFor, type ZudomartWordmarkVariant } from "@zudomart/web-kit/brandPath";
import Svg, { Path, Rect } from "react-native-svg";

import { useTheme } from "@/theme";

export type ZudomartWordmarkTone = "brand" | "mono";

export interface ZudomartWordmarkProps {
  readonly height?: number;
  readonly tone?: ZudomartWordmarkTone;
  readonly variant?: ZudomartWordmarkVariant;
}

export function ZudomartWordmark({ height = 18, tone = "brand", variant = defaultZudomartWordmarkVariant }: ZudomartWordmarkProps) {
  const { colors } = useTheme();
  const { width, height: pathHeight, d } = zudomartWordmarkFor(variant, height);
  return (
    <Svg width={(height * width) / pathHeight} height={height} viewBox={`0 0 ${width} ${pathHeight}`} accessibilityRole="image" accessibilityLabel="Zudomart">
      <Path d={d} fill={tone === "brand" ? colors.primary : colors.text} />
    </Svg>
  );
}

export function ZudomartLogoMark({ size = 26 }: { readonly size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${zudomartSymbolViewBox} ${zudomartSymbolViewBox}`} accessibilityRole="image" accessibilityLabel="Zudomart">
      <Rect width={zudomartSymbolViewBox} height={zudomartSymbolViewBox} rx={zudomartSymbolTileRadius} fill={colors.primarySolid} />
      <Path d={zudomartSymbolPath()} fill={colors.onPrimary} />
    </Svg>
  );
}
