import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";

import { useTheme } from "@/theme";
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
  color,
  lineHeight,
  letterSpacing,
  align,
  underline,
  style,
  ...props
}: TextProps) {
  const { colors } = useTheme();
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
          color: color ?? colors.text,
          ...(align ? { textAlign: align } : null),
          ...(underline ? { textDecorationLine: "underline" as const } : null),
        },
        style,
      ]}
    />
  );
}
