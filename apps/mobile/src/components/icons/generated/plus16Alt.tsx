import Svg, { Path } from "react-native-svg";

import { useThemedIconInk } from "@/theme/makeThemedStyles.util";

import type { IconProps } from "../icon.types";

export function Plus16AltIcon({ size, color, style }: IconProps) {
  const ink = useThemedIconInk("#3A2BFF");
  const scale = size === undefined ? 1 : size / 16;
  return (
    <Svg width={16 * scale} height={16 * scale} viewBox="0 0 16 16" fill="none" style={style}>
      <Path d="M12 6C12 6.13261 11.9473 6.25979 11.8536 6.35355C11.7598 6.44732 11.6326 6.5 11.5 6.5L6.5 6.5L6.5 11.5C6.5 11.6326 6.44732 11.7598 6.35355 11.8536C6.25979 11.9473 6.13261 12 6 12C5.86739 12 5.74021 11.9473 5.64645 11.8536C5.55268 11.7598 5.5 11.6326 5.5 11.5L5.5 6.5L0.5 6.5C0.367392 6.5 0.240215 6.44732 0.146447 6.35355C0.0526785 6.25979 0 6.13261 0 6C0 5.86739 0.0526785 5.74021 0.146447 5.64645C0.240215 5.55268 0.367392 5.5 0.5 5.5L5.5 5.5L5.5 0.5C5.5 0.367392 5.55268 0.240215 5.64645 0.146447C5.74021 0.0526785 5.86739 -4.44089e-16 6 0C6.13261 -4.44089e-16 6.25979 0.0526785 6.35355 0.146447C6.44732 0.240215 6.5 0.367392 6.5 0.5L6.5 5.5L11.5 5.5C11.6326 5.5 11.7598 5.55268 11.8536 5.64645C11.9473 5.74021 12 5.86739 12 6Z" fillRule="nonzero" transform="matrix(1 0 0 1 2 2)" fill={color ?? ink} />
    </Svg>
  );
}
