import Svg, { Path } from "react-native-svg";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "../icon.types";

export function Swords24Icon({ size = 24, color, style }: IconProps) {
  const themedInk = useThemedIconInk("#000000");
  const ink = color ?? themedInk;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d={"M14.5 17.5 3 6V3h3l11.5 11.5"} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={"m13 19 6-6"} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={"m16 16 4 4"} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={"m19 21 2-2"} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={"M14.5 6.5 18 3h3v3l-3.5 3.5"} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={"m5 14 4 4"} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={"m7 17-3 3"} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={"m3 19 2 2"} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
