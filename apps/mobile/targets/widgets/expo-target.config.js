const { brandPalette, darkColors, lightColors } = require("./widgetColors.json");

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "ZudomartWidgets",
  displayName: "Zudomart",
  bundleIdentifier: ".widgets",
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "WidgetKit", "Security"],
  colors: {
    $accent: { light: brandPalette.brand, dark: darkColors.brandSolid },
    $widgetBackground: { light: lightColors.surface, dark: darkColors.canvas },
    ZudoBrand: { light: lightColors.brandSolid, dark: darkColors.brandSolid },
    ZudoSurface: { light: lightColors.sunken, dark: darkColors.surface },
    ZudoText: { light: lightColors.text, dark: darkColors.text },
    ZudoMuted: { light: lightColors.textMuted, dark: darkColors.textMuted },
    ZudoSeenRing: { light: lightColors.borderStrong, dark: darkColors.borderStrong },
    ZudoLive: { light: lightColors.danger, dark: darkColors.danger },
  },
  entitlements: {
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
  },
});
