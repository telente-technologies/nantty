import Svg, { Path } from "react-native-svg";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "../icon.types";

export function SignOut24Icon({ size = 24, color, style }: IconProps) {
  const themedInk = useThemedIconInk("#000000");
  const ink = color ?? themedInk;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d={"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={"m16 17 5-5-5-5"} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={"M21 12H9"} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
