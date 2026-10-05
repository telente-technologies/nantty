import Svg, { Path } from "react-native-svg";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "../icon.types";

export function Group1234Icon({ size, color, style }: IconProps) {
  const ink = useThemedIconInk("#D9D9D9");
  const scale = size === undefined ? 1 : size / 34;
  return (
    <Svg width={34 * scale} height={14 * scale} viewBox="0 0 34 14" fill="none" style={style}>
      <Path d="M14 7C14 10.866 10.866 14 7 14C3.13401 14 0 10.866 0 7C0 3.13401 3.13401 0 7 0C10.866 0 14 3.13401 14 7Z" fillRule="nonzero" transform="matrix(1 0 0 1 0 0)" fill={color ?? ink} />
      <Path d="M14 7L13 7C13 10.3137 10.3137 13 7 13L7 14L7 15C11.4183 15 15 11.4183 15 7L14 7ZM7 14L7 13C3.68629 13 1 10.3137 1 7L0 7L-1 7C-1 11.4183 2.58172 15 7 15L7 14ZM0 7L1 7C1 3.68629 3.68629 1 7 1L7 0L7 -1C2.58172 -1 -1 2.58172 -1 7L0 7ZM7 0L7 1C10.3137 1 13 3.68629 13 7L14 7L15 7C15 2.58172 11.4183 -1 7 -1L7 0Z" fillRule="nonzero" transform="matrix(1 0 0 1 0 0)" fill="#5B5B5B" />
      <Path d="M14 7C14 10.866 10.866 14 7 14C3.13401 14 0 10.866 0 7C0 3.13401 3.13401 0 7 0C10.866 0 14 3.13401 14 7Z" fillRule="nonzero" transform="matrix(1 0 0 1 10 0)" fill={color ?? ink} />
      <Path d="M14 7L13 7C13 10.3137 10.3137 13 7 13L7 14L7 15C11.4183 15 15 11.4183 15 7L14 7ZM7 14L7 13C3.68629 13 1 10.3137 1 7L0 7L-1 7C-1 11.4183 2.58172 15 7 15L7 14ZM0 7L1 7C1 3.68629 3.68629 1 7 1L7 0L7 -1C2.58172 -1 -1 2.58172 -1 7L0 7ZM7 0L7 1C10.3137 1 13 3.68629 13 7L14 7L15 7C15 2.58172 11.4183 -1 7 -1L7 0Z" fillRule="nonzero" transform="matrix(1 0 0 1 10 0)" fill="#5B5B5B" />
      <Path d="M14 7C14 10.866 10.866 14 7 14C3.13401 14 0 10.866 0 7C0 3.13401 3.13401 0 7 0C10.866 0 14 3.13401 14 7Z" fillRule="nonzero" transform="matrix(1 0 0 1 20 0)" fill={color ?? ink} />
      <Path d="M14 7L13 7C13 10.3137 10.3137 13 7 13L7 14L7 15C11.4183 15 15 11.4183 15 7L14 7ZM7 14L7 13C3.68629 13 1 10.3137 1 7L0 7L-1 7C-1 11.4183 2.58172 15 7 15L7 14ZM0 7L1 7C1 3.68629 3.68629 1 7 1L7 0L7 -1C2.58172 -1 -1 2.58172 -1 7L0 7ZM7 0L7 1C10.3137 1 13 3.68629 13 7L14 7L15 7C15 2.58172 11.4183 -1 7 -1L7 0Z" fillRule="nonzero" transform="matrix(1 0 0 1 20 0)" fill="#5B5B5B" />
    </Svg>
  );
}
