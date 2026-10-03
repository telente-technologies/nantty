import Svg, { Path } from "react-native-svg";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "../icon.types";

export function Analytics24Icon({ size, color, style }: IconProps) {
  const scale = size === undefined ? 1 : size / 24;
  const themedInk = useThemedIconInk("#000000");
  const stroke = color ?? themedInk;
  return (
    <Svg width={24 * scale} height={24 * scale} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M3.5 20.5H20.5" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
      <Path d="M7 20.5V14.5" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 20.5V9.5" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
      <Path d="M17 20.5V4.5" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
