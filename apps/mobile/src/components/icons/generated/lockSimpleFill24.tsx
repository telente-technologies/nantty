import Svg, { Path } from "react-native-svg";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "../icon.types";

export function LockSimpleFill24Icon({ size, color, style }: IconProps) {
  const ink = useThemedIconInk("#000000");
  const scale = size === undefined ? 1 : size / 24;
  return (
    <Svg width={24 * scale} height={24 * scale} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96Z" fillRule="nonzero" transform="matrix(0.09375 0 0 0.09375 0 0)" fill={color ?? ink} />
    </Svg>
  );
}
