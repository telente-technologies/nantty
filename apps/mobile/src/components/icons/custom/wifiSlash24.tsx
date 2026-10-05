import Svg, { Circle, Path } from "react-native-svg";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "../icon.types";

export function WifiSlash24Icon({ size = 24, color, style }: IconProps) {
  const themedInk = useThemedIconInk("#000000");
  const ink = color ?? themedInk;
  const line = { stroke: ink, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M2 8.8a15 15 0 0 1 4.2-2.7" {...line} />
      <Path d="M10.6 5.1A15 15 0 0 1 22 8.8" {...line} />
      <Path d="M5 12.6a10 10 0 0 1 5.2-2.5" {...line} />
      <Path d="M15.1 10.8A10 10 0 0 1 19 12.6" {...line} />
      <Path d="M8.5 16.1a5 5 0 0 1 7 0" {...line} />
      <Path d="m3 3 18 18" {...line} />
      <Circle cx={12} cy={19.6} r={1} fill={ink} />
    </Svg>
  );
}
