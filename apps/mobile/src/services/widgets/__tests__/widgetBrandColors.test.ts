import { darkColors, lightColors } from "@zudomart/design-tokens/native";

import { figmaDarkCanvas } from "@/theme/themeColors.constant";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const widgetColors = require("../../../../targets/widgets/widgetColors.json") as {
  brandPalette: { brand: string };
  lightColors: Record<string, string>;
  darkColors: Record<string, string>;
};

describe("iOS widget colors", () => {
  it("stay in sync with the Zudomart design tokens", () => {
    for (const [name, value] of Object.entries(widgetColors.lightColors)) expect(value).toBe(lightColors[name as keyof typeof lightColors]);
    for (const [name, value] of Object.entries(widgetColors.darkColors)) {
      if (name === "canvas") expect(value).toBe(figmaDarkCanvas);
      else if (name === "surface") expect(value).toBe("#1E2024");
      else expect(value).toBe(darkColors[name as keyof typeof darkColors]);
    }
    expect(widgetColors.brandPalette.brand).toBe(lightColors.brand);
  });
});
