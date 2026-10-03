import Svg, { Path } from "react-native-svg";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "../icon.types";

export function Shield24Icon({ size, color, style }: IconProps) {
  const ink = useThemedIconInk("#000000");
  const scale = size === undefined ? 1 : size / 24;
  return (
    <Svg width={24 * scale} height={24 * scale} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M16.5 0L1.5 0C1.10218 6.66134e-16 0.720644 0.158035 0.43934 0.43934C0.158035 0.720644 1.33227e-15 1.10218 0 1.5L0 6.75C0 11.6925 2.3925 14.6878 4.39969 16.3303C6.56156 18.0984 8.71219 18.6994 8.80594 18.7238C8.93484 18.7588 9.07078 18.7588 9.19969 18.7238C9.29344 18.6994 11.4413 18.0984 13.6059 16.3303C15.6075 14.6878 18 11.6925 18 6.75L18 1.5C18 1.10218 17.842 0.720644 17.5607 0.43934C17.2794 0.158035 16.8978 1.33227e-15 16.5 0ZM16.5 6.75C16.5 10.2253 15.2194 13.0462 12.6937 15.1331C11.5943 16.0385 10.344 16.743 9 17.2144C7.67363 16.7512 6.4387 16.0592 5.35125 15.1697C2.79563 13.0791 1.5 10.2469 1.5 6.75L1.5 1.5L16.5 1.5L16.5 6.75Z" fillRule="nonzero" transform="matrix(1 0 0 1 3 3.75)" fill={color ?? ink} />
    </Svg>
  );
}
