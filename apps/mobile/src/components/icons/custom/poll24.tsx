import Svg, { Circle, Path } from "react-native-svg";

import type { IconProps } from "../icon.types";

export function Poll24Icon({ size, color, style }: IconProps) {
  const scale = size === undefined ? 1 : size / 24;
  const stroke = color ?? "#000000";
  return (
    <Svg width={24 * scale} height={24 * scale} viewBox="0 0 24 24" fill="none" style={style}>
      <Circle cx={5.5} cy={7} r={2.5} stroke={stroke} strokeWidth={2} />
      <Path d="M11 7H20" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={5.5} cy={12} r={2.5} stroke={stroke} strokeWidth={2} />
      <Path d="M11 12H20" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={5.5} cy={17} r={2.5} stroke={stroke} strokeWidth={2} />
      <Path d="M11 17H16" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
