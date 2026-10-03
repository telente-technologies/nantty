import Svg, { Path } from "react-native-svg";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "../icon.types";

export function BookmarkFill24Icon({ size, color, style }: IconProps) {
  const scale = size === undefined ? 1 : size / 24;
  const themedInk = useThemedIconInk("#000000");
  const ink = color ?? themedInk;
  return (
    <Svg width={24 * scale} height={24 * scale} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M10 3h4a4 4 0 0 1 4 4v14l-6-4-6 4V7a4 4 0 0 1 4-4Z" fill={ink} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
