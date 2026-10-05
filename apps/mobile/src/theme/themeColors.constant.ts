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

export const figmaDarkCanvas = "#0E0E10";
export const figmaDarkSurface = "#2C2C2C";

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
  surface: figmaDarkSurface,
  elevated: "#3A3A3D",
  sunken: "#1A1A1D",

  text: colors.white,
  textMuted: "#B3B3B3",
  textSubtle: "#A6A6A6",
  textFaint: "#A6A6A6",

  placeholder: "#3A3A3D",
  inputPlaceholderText: "#8E8E92",
  divider: "#3D3D40",
  chip: "#3A3A3D",
  disabled: "#3A3A3D",
  disabledText: "#7A7A7D",
  avatar: "#48484B",
  media: colors.media,
  skeleton: "#38383B",
  overlay: semanticDark.overlay,
};

export const themeColorsByScheme: Readonly<Record<ColorSchemeName, ThemeColors>> = {
  light: lightThemeColors,
  dark: darkThemeColors,
};
