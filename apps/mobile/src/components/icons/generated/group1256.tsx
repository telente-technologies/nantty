import Svg, { Path } from "react-native-svg";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "../icon.types";

export function Group1256Icon({ size, color, style }: IconProps) {
  const ink = useThemedIconInk("#D9D9D9");
  const scale = size === undefined ? 1 : size / 56;
  return (
    <Svg width={56 * scale} height={24 * scale} viewBox="0 0 56 24" fill="none" style={style}>
      <Path d="M24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0C18.6274 0 24 5.37258 24 12Z" fillRule="nonzero" transform="matrix(1 0 0 1 0 0)" fill={color ?? ink} />
      <Path d="M24 12L23 12C23 18.0751 18.0751 23 12 23L12 24L12 25C19.1797 25 25 19.1797 25 12L24 12ZM12 24L12 23C5.92487 23 1 18.0751 1 12L0 12L-1 12C-1 19.1797 4.8203 25 12 25L12 24ZM0 12L1 12C1 5.92487 5.92487 1 12 1L12 0L12 -1C4.8203 -1 -1 4.8203 -1 12L0 12ZM12 0L12 1C18.0751 1 23 5.92487 23 12L24 12L25 12C25 4.8203 19.1797 -1 12 -1L12 0Z" fillRule="nonzero" transform="matrix(1 0 0 1 0 0)" fill="#5B5B5B" />
      <Path d="M24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0C18.6274 0 24 5.37258 24 12Z" fillRule="nonzero" transform="matrix(1 0 0 1 16 0)" fill={color ?? ink} />
      <Path d="M24 12L23 12C23 18.0751 18.0751 23 12 23L12 24L12 25C19.1797 25 25 19.1797 25 12L24 12ZM12 24L12 23C5.92487 23 1 18.0751 1 12L0 12L-1 12C-1 19.1797 4.8203 25 12 25L12 24ZM0 12L1 12C1 5.92487 5.92487 1 12 1L12 0L12 -1C4.8203 -1 -1 4.8203 -1 12L0 12ZM12 0L12 1C18.0751 1 23 5.92487 23 12L24 12L25 12C25 4.8203 19.1797 -1 12 -1L12 0Z" fillRule="nonzero" transform="matrix(1 0 0 1 16 0)" fill="#5B5B5B" />
      <Path d="M24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0C18.6274 0 24 5.37258 24 12Z" fillRule="nonzero" transform="matrix(1 0 0 1 32 0)" fill={color ?? ink} />
      <Path d="M24 12L23 12C23 18.0751 18.0751 23 12 23L12 24L12 25C19.1797 25 25 19.1797 25 12L24 12ZM12 24L12 23C5.92487 23 1 18.0751 1 12L0 12L-1 12C-1 19.1797 4.8203 25 12 25L12 24ZM0 12L1 12C1 5.92487 5.92487 1 12 1L12 0L12 -1C4.8203 -1 -1 4.8203 -1 12L0 12ZM12 0L12 1C18.0751 1 23 5.92487 23 12L24 12L25 12C25 4.8203 19.1797 -1 12 -1L12 0Z" fillRule="nonzero" transform="matrix(1 0 0 1 32 0)" fill="#5B5B5B" />
    </Svg>
  );
}
