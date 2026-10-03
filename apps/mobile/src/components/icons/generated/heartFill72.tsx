import Svg, { Path } from "react-native-svg";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "../icon.types";

export function HeartFill72Icon({ size, color, style }: IconProps) {
  const ink = useThemedIconInk("#EF4444");
  const scale = size === undefined ? 1 : size / 72;
  return (
    <Svg width={72 * scale} height={72 * scale} viewBox="0 0 72 72" fill="none" style={style}>
      <Path d="M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z" fillRule="nonzero" transform="matrix(0.28125 0 0 0.28125 0 0)" fill={color ?? ink} />
    </Svg>
  );
}
