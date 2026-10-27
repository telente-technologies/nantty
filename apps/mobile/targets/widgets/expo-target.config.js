const { brandPalette, darkColors, lightColors } = require("./widgetColors.json");

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "NanttyWidgets",
  displayName: "Nantty",
  bundleIdentifier: ".widgets",
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "WidgetKit", "Security"],
  colors: {
    $accent: { light: brandPalette.brand, dark: darkColors.brandSolid },
    $widgetBackground: { light: lightColors.surface, dark: darkColors.canvas },
    NanttyBrand: { light: lightColors.brandSolid, dark: darkColors.brandSolid },
    NanttySurface: { light: lightColors.sunken, dark: darkColors.surface },
    NanttyText: { light: lightColors.text, dark: darkColors.text },
    NanttyMuted: { light: lightColors.textMuted, dark: darkColors.textMuted },
    NanttySeenRing: { light: lightColors.borderStrong, dark: darkColors.borderStrong },
    NanttyLive: { light: lightColors.danger, dark: darkColors.danger },
  },
  entitlements: {
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
  },
});
