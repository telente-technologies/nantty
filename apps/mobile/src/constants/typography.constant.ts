export const fontFamily = {
  400: "Inter_400Regular",
  500: "Inter_500Medium",
  600: "Inter_600SemiBold",
  700: "Inter_700Bold",
  900: "Inter_900Black",
} as const;

export type FontWeight = keyof typeof fontFamily;

export const calculateDefaultLineHeight = (size: number): number => Math.round(size * 1.2 * 10) / 10;
export const calculateDefaultLetterSpacing = (size: number): number => Math.round(size * -0.02 * 100) / 100;

export const textStyles = {
  h1: { size: 21, lineHeight: 25 },
  h2: { size: 18, lineHeight: 22 },
  h3: { size: 16, lineHeight: 19 },
  base: { size: 14, lineHeight: 17 },
  meta: { size: 13, lineHeight: 17 },
  caption: { size: 12, lineHeight: 17 },
  micro: { size: 11, lineHeight: 15 },
} as const;

export { typeScale } from "@nantty/design-tokens/native";
