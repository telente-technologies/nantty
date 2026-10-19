import { darkColors as semanticDark } from "@zudomart/design-tokens/native";

import { colors, palette } from "@/constants/colors.constant";

export type ColorSchemeName = "light" | "dark";

export const lightThemeColors = {
  ...colors,
  primarySolid: colors.primary,
  onPrimary: colors.white,
  link: colors.primary,
  elevated: colors.white,
  sunken: colors.background,
  inputPlaceholderText: colors.placeholder,
  successTint: palette.success[50],
  successText: palette.success[700],
  cautionTint: palette.caution[50],
  cautionText: palette.caution[700],
  cautionStrongText: palette.caution[800],
} as const;

export type ThemeColors = { readonly [Key in keyof typeof lightThemeColors]: string };

export const figmaDarkCanvas = "#15161A";
export const figmaDarkSurface = "#1E2024";

export const darkThemeColors: ThemeColors = {
  primary: semanticDark.brand,
  primaryDark: palette.primary[600],
  primaryTint: semanticDark.brandTint,
  primarySolid: colors.primary,
  onPrimary: colors.white,
  link: semanticDark.brand,
  error: semanticDark.danger,
  errorTint: semanticDark.dangerTint,
  success: semanticDark.success,
  successTint: semanticDark.successTint,
  successText: semanticDark.successText,
  caution: semanticDark.warn,
  cautionTint: semanticDark.warnTint,
  cautionText: semanticDark.warnText,
  cautionStrongText: semanticDark.warnText,
  star: semanticDark.warn,
  live: colors.live,

  white: colors.white,
  black: colors.black,
  background: figmaDarkCanvas,
  surface: "#15161A",
  elevated: figmaDarkSurface,
  sunken: "#15161A",

  text: "#E8E9EB",
  textMuted: "#9A9DA3",
  textSubtle: "#8A8D94",
  textFaint: "#8A8D94",

  placeholder: figmaDarkSurface,
  inputPlaceholderText: "#8A8D94",
  divider: "#2C2E33",
  chip: "#26282D",
  disabled: "#26282D",
  disabledText: "#6B6F77",
  avatar: "#2C2E33",
  media: colors.media,
  skeleton: figmaDarkSurface,
  overlay: semanticDark.overlay,
};

export const themeColorsByScheme: Readonly<Record<ColorSchemeName, ThemeColors>> = {
  light: lightThemeColors,
  dark: darkThemeColors,
};
