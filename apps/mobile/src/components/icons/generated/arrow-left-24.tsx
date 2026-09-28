import Svg, { Path } from "react-native-svg";

import type { IconProps } from "../icon.types";

export function ArrowLeft24Icon({ size, color, style }: IconProps) {
  const scale = size === undefined ? 1 : size / 24;
  return (
    <Svg width={24 * scale} height={24 * scale} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M6.29289 14.7071C6.68342 15.0976 7.31658 15.0976 7.70711 14.7071C8.09763 14.3166 8.09763 13.6834 7.70711 13.2929L7 14L6.29289 14.7071ZM0 7L-0.707107 6.29289C-1.09763 6.68342 -1.09763 7.31658 -0.707107 7.70711L0 7ZM7.70711 0.707107C8.09763 0.316583 8.09763 -0.316583 7.70711 -0.707107C7.31658 -1.09763 6.68342 -1.09763 6.29289 -0.707107L7 0L7.70711 0.707107ZM14 8C14.5523 8 15 7.55228 15 7C15 6.44772 14.5523 6 14 6L14 7L14 8ZM7 14L7.70711 13.2929L0.707107 6.29289L0 7L-0.707107 7.70711L6.29289 14.7071L7 14ZM0 7L0.707107 7.70711L7.70711 0.707107L7 0L6.29289 -0.707107L-0.707107 6.29289L0 7ZM14 7L14 6L0 6L0 7L0 8L14 8L14 7Z" fillRule="nonzero" transform="matrix(1 0 0 1 5 5)" fill={color ?? "#000000"} />
    </Svg>
  );
}
