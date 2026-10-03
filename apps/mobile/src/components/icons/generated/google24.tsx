import Svg, { Path } from "react-native-svg";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "../icon.types";

export function Google24Icon({ size, color, style }: IconProps) {
  const ink = useThemedIconInk("#FFC107");
  const scale = size === undefined ? 1 : size / 24;
  return (
    <Svg width={24 * scale} height={24 * scale} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M19.8055 8.0415L19 8.0415L19 8L10 8L10 12L15.6515 12C14.827 14.3285 12.6115 16 10 16C6.6865 16 4 13.3135 4 10C4 6.6865 6.6865 4 10 4C11.5295 4 12.921 4.577 13.9805 5.5195L16.809 2.691C15.023 1.0265 12.634 0 10 0C4.4775 0 0 4.4775 0 10C0 15.5225 4.4775 20 10 20C15.5225 20 20 15.5225 20 10C20 9.3295 19.931 8.675 19.8055 8.0415Z" fillRule="nonzero" transform="matrix(1 0 0 1 2 2)" fill={color ?? ink} />
      <Path d="M0 5.3455L3.2855 7.755C4.1745 5.554 6.3275 4 8.847 4C10.3765 4 11.768 4.577 12.8275 5.5195L15.656 2.691C13.87 1.0265 11.481 0 8.847 0C5.006 0 1.675 2.1685 0 5.3455Z" fillRule="nonzero" transform="matrix(1 0 0 1 3.153 2)" fill="#FF3D00" />
      <Path d="M8.9025 7.973C11.4855 7.973 13.8325 6.9845 15.607 5.377L12.512 2.758C11.4744 3.54753 10.2063 3.9744 8.9025 3.973C6.3015 3.973 4.093 2.3145 3.261 0L0 2.5125C1.655 5.751 5.016 7.973 8.9025 7.973Z" fillRule="nonzero" transform="matrix(1 0 0 1 3.0975 14.027)" fill="#4CAF50" />
      <Path d="M9.8055 0.0415001L9 0.0415001L9 0L0 0L0 4L5.6515 4C5.2571 5.10821 4.54668 6.07659 3.608 6.7855L3.6095 6.7845L6.7045 9.4035C6.4855 9.6025 10 7 10 2C10 1.3295 9.931 0.675 9.8055 0.0415001Z" fillRule="nonzero" transform="matrix(1 0 0 1 12 10)" fill="#1976D2" />
    </Svg>
  );
}
