import type { WidgetTaskHandlerProps } from "react-native-android-widget";

import { androidWidgetNames, widgetKinds, type WidgetKind } from "@/config/widgets.config";

import { renderStoredAndroidWidget } from "./renderAndroidWidget";

const kindByWidgetName = new Map<string, WidgetKind>(widgetKinds.map((kind) => [androidWidgetNames[kind], kind]));

export async function handleAndroidWidgetTask(props: WidgetTaskHandlerProps): Promise<void> {
  const kind = kindByWidgetName.get(props.widgetInfo.widgetName);
  if (kind === undefined || props.widgetAction === "WIDGET_DELETED" || props.widgetAction === "WIDGET_CLICK") return;
  props.renderWidget(await renderStoredAndroidWidget(kind, props.widgetInfo, props.widgetAction === "WIDGET_UPDATE" || props.widgetAction === "WIDGET_ADDED"));
}
