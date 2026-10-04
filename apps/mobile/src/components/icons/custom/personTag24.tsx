import Svg, { Circle, Path } from "react-native-svg";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "../icon.types";

export function PersonTag24Icon({ size = 24, color, style }: IconProps) {
  const themedInk = useThemedIconInk("#000000");
  const ink = color ?? themedInk;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Circle cx={10} cy={7.5} r={3.75} stroke={ink} strokeWidth={1.6} />
      <Path d="M3.25 20c.6-3.7 3.3-6 6.75-6 1.2 0 2.3.28 3.25.8" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M15.5 15.25h3.6l2.15 2.4-2.15 2.4h-3.6a.9.9 0 0 1-.9-.9v-3a.9.9 0 0 1 .9-.9Z" stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  );
}
