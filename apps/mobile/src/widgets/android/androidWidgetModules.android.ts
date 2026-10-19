export interface AndroidWidgetModules {
  readonly widgets: typeof import("react-native-android-widget");
  readonly renderer: typeof import("./renderAndroidWidget");
}

export function loadAndroidWidgetModules(): AndroidWidgetModules | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const widgets = require("react-native-android-widget") as AndroidWidgetModules["widgets"];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const renderer = require("./renderAndroidWidget") as AndroidWidgetModules["renderer"];
    return typeof widgets.requestWidgetUpdate === "function" ? { widgets, renderer } : null;
  } catch {
    return null;
  }
}
