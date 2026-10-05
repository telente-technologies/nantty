import { brandPalette } from "@zudomart/design-tokens/native";

export const palette = {
  primary: brandPalette,

  secondary: {
    50: "#FDF9D2",
    100: "#FCF6B5",
    200: "#FAF18F",
    300: "#F8EC6A",
    400: "#F7E845",
    500: "#F5E320",
    600: "#CCBD1B",
    700: "#A39715",
    800: "#7A7110",
    900: "#524C0B",
  },
  success: {
    50: "#E7F8F2",
    100: "#B5E9D8",
    200: "#91DFC5",
    300: "#5FD0AB",
    400: "#40C79A",
    500: "#10B981",
    600: "#0FA875",
    700: "#0B835C",
    800: "#096647",
    900: "#074E36",
  },
  caution: {
    50: "#FEF5E7",
    100: "#FCE1B3",
    200: "#FAD28F",
    300: "#F8BE5C",
    400: "#F7B13C",
    500: "#F59E0B",
    600: "#DF900A",
    700: "#AE7008",
    800: "#875706",
    900: "#674205",
  },
  error: {
    50: "#FDECEC",
    100: "#FAC5C5",
    200: "#F8A9A9",
    300: "#F48282",
    400: "#F26969",
    500: "#EF4444",
    600: "#D93E3E",
    700: "#AA3030",
    800: "#832525",
    900: "#641D1D",
  },
} as const;

export const colors = {
  primary: palette.primary[500],
  primaryDark: palette.primary[600],
  primaryTint: palette.primary[50],
  error: palette.error[500],
  errorTint: palette.error[50],
  success: palette.success[500],
  caution: palette.caution[500],
  star: palette.caution[500],
  live: "#FF3B30",

  white: "#FFFFFF",
  black: "#000000",
  background: "#F7F8FE",
  surface: "#FFFFFF",

  text: "#000000",
  textMuted: "#5B5B5B",
  textSubtle: "#909090",
  textFaint: "#6E6E80",

  placeholder: "#D9D9D9",
  divider: "#D9D9D9",
  chip: "#DADADA",
  disabled: "#D9D9D9",
  disabledText: "#909090",
  avatar: "#5B5B5B",
  media: "#1E1E1E",
  skeleton: "#ECECEC",
  overlay: "rgba(0,0,0,0.5)",
} as const;

export type ColorToken = keyof typeof colors;
