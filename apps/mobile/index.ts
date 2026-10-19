import { registerRootComponent } from "expo";

import App from "./App";
import { registerAndroidHomeScreenWidgets } from "./src/widgets/android/registerAndroidWidgets";

registerRootComponent(App);
registerAndroidHomeScreenWidgets();
