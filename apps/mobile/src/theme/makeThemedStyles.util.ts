import { useTheme } from "./theme.provider";
import type { ColorSchemeName, ThemeColors } from "./themeColors.constant";

export function makeThemedStyles<Styles>(createStylesForColors: (colors: ThemeColors, scheme: ColorSchemeName) => Styles): () => Styles {
  const stylesByColors = new Map<ThemeColors, Styles>();
  return function useThemedStyles() {
    const { colors, scheme } = useTheme();
    const cached = stylesByColors.get(colors);
    if (cached) return cached;
    const created = createStylesForColors(colors, scheme);
    stylesByColors.set(colors, created);
    return created;
  };
}

const LIGHT_INK_TO_THEME_KEY: Readonly<Record<string, keyof ThemeColors>> = {
  "#000000": "text",
  "#000": "text",
  "#5B5B5B": "textMuted",
  "#909090": "textSubtle",
  "#D9D9D9": "placeholder",
  "#3A2BFF": "primary",
};

export function useThemedIconInk(figmaInk: string): string {
  const { colors, isDark } = useTheme();
  if (!isDark) return figmaInk;
  const themeKey = LIGHT_INK_TO_THEME_KEY[figmaInk];
  return themeKey ? colors[themeKey] : figmaInk;
}
