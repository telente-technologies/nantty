import { areHomeScreenWidgetsSupported } from "@/services/widgets/widgetNativeBridge.service";

export function registerAndroidHomeScreenWidgets(): void {
  if (!areHomeScreenWidgetsSupported()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerWidgetTaskHandler } = require("react-native-android-widget") as typeof import("react-native-android-widget");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { handleAndroidWidgetTask } = require("./androidWidgetTaskHandler") as typeof import("./androidWidgetTaskHandler");
    registerWidgetTaskHandler(handleAndroidWidgetTask);
  } catch {
    return;
  }
}
