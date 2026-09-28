import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";

import { colors } from "@/constants/colors.constant";
import { fontFamily, calculateDefaultLetterSpacing, calculateDefaultLineHeight, type FontWeight } from "@/constants/typography.constant";

export interface TextProps extends RNTextProps {
  readonly size?: number;
  readonly weight?: FontWeight;
  readonly color?: string;
  readonly lineHeight?: number;
  readonly letterSpacing?: number;
  readonly align?: TextStyle["textAlign"];
  readonly underline?: boolean;
}

export function Text({
  size = 14,
  weight = 400,
  color = colors.text,
  lineHeight,
  letterSpacing,
  align,
  underline,
  style,
  ...props
}: TextProps) {
  return (
    <RNText
      allowFontScaling
      maxFontSizeMultiplier={1.3}
      {...props}
      style={[
        {
          fontFamily: fontFamily[weight],
          fontSize: size,
          lineHeight: lineHeight ?? calculateDefaultLineHeight(size),
          letterSpacing: letterSpacing ?? calculateDefaultLetterSpacing(size),
          color,
          ...(align ? { textAlign: align } : null),
          ...(underline ? { textDecorationLine: "underline" as const } : null),
        },
        style,
      ]}
    />
  );
}
