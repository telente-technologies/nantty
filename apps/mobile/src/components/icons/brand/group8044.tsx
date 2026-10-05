import Svg, { Path } from "react-native-svg";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "../icon.types";

export function Group8044Icon({ size, color, style }: IconProps) {
  const ink = useThemedIconInk("#D9D9D9");
  const scale = size === undefined ? 1 : size / 44;
  return (
    <Svg width={44 * scale} height={20 * scale} viewBox="0 0 44 20" fill="none" style={style}>
      <Path d="M20 10C20 15.5228 15.5228 20 10 20C4.47715 20 0 15.5228 0 10C0 4.47715 4.47715 0 10 0C15.5228 0 20 4.47715 20 10Z" fillRule="nonzero" transform="matrix(1 0 0 1 24 0)" fill={color ?? ink} />
      <Path d="M20 10L19 10C19 14.9706 14.9706 19 10 19L10 20L10 21C16.0751 21 21 16.0751 21 10L20 10ZM10 20L10 19C5.02944 19 1 14.9706 1 10L0 10L-1 10C-1 16.0751 3.92487 21 10 21L10 20ZM0 10L1 10C1 5.02944 5.02944 1 10 1L10 0L10 -1C3.92487 -1 -1 3.92487 -1 10L0 10ZM10 0L10 1C14.9706 1 19 5.02944 19 10L20 10L21 10C21 3.92487 16.0751 -1 10 -1L10 0Z" fillRule="nonzero" transform="matrix(1 0 0 1 24 0)" fill="#000000" />
      <Path d="M20 10C20 15.5228 15.5228 20 10 20C4.47715 20 0 15.5228 0 10C0 4.47715 4.47715 0 10 0C15.5228 0 20 4.47715 20 10Z" fillRule="nonzero" transform="matrix(1 0 0 1 12 0)" fill={color ?? ink} />
      <Path d="M20 10L19 10C19 14.9706 14.9706 19 10 19L10 20L10 21C16.0751 21 21 16.0751 21 10L20 10ZM10 20L10 19C5.02944 19 1 14.9706 1 10L0 10L-1 10C-1 16.0751 3.92487 21 10 21L10 20ZM0 10L1 10C1 5.02944 5.02944 1 10 1L10 0L10 -1C3.92487 -1 -1 3.92487 -1 10L0 10ZM10 0L10 1C14.9706 1 19 5.02944 19 10L20 10L21 10C21 3.92487 16.0751 -1 10 -1L10 0Z" fillRule="nonzero" transform="matrix(1 0 0 1 12 0)" fill="#000000" />
      <Path d="M20 10C20 15.5228 15.5228 20 10 20C4.47715 20 0 15.5228 0 10C0 4.47715 4.47715 0 10 0C15.5228 0 20 4.47715 20 10Z" fillRule="nonzero" transform="matrix(1 0 0 1 0 0)" fill={color ?? ink} />
      <Path d="M20 10L19 10C19 14.9706 14.9706 19 10 19L10 20L10 21C16.0751 21 21 16.0751 21 10L20 10ZM10 20L10 19C5.02944 19 1 14.9706 1 10L0 10L-1 10C-1 16.0751 3.92487 21 10 21L10 20ZM0 10L1 10C1 5.02944 5.02944 1 10 1L10 0L10 -1C3.92487 -1 -1 3.92487 -1 10L0 10ZM10 0L10 1C14.9706 1 19 5.02944 19 10L20 10L21 10C21 3.92487 16.0751 -1 10 -1L10 0Z" fillRule="nonzero" transform="matrix(1 0 0 1 0 0)" fill="#000000" />
    </Svg>
  );
}
