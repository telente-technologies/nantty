import Svg, { Path } from "react-native-svg";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "../icon.types";

export function Trophy24Icon({ size = 24, color, style }: IconProps) {
  const themedInk = useThemedIconInk("#000000");
  const ink = color ?? themedInk;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d={"M6 9H4.5a2.5 2.5 0 0 1 0-5H6"} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={"M18 9h1.5a2.5 2.5 0 0 0 0-5H18"} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={"M4 22h16"} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={"M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={"M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={"M18 2H6v7a6 6 0 0 0 12 0V2Z"} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
