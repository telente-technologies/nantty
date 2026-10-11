import { registerRootComponent } from "expo";
import { Platform } from "react-native";

import App from "./App";

registerRootComponent(App);

if (Platform.OS === "android") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerAndroidHomeScreenWidgets } = require("./src/widgets/android/registerAndroidWidgets") as typeof import("./src/widgets/android/registerAndroidWidgets");
  registerAndroidHomeScreenWidgets();
}
