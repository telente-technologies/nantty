import Svg, { Path } from "react-native-svg";

import type { IconProps } from "../icon.types";

export function Document24Icon({ size, color, style }: IconProps) {
  const scale = size === undefined ? 1 : size / 24;
  const stroke = color ?? "#000000";
  return (
    <Svg width={24 * scale} height={24 * scale} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M6 3.5H14L19 8.5V20.5H6V3.5Z" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M14 3.5V8.5H19" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M9 13H16" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
      <Path d="M9 16.5H16" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
