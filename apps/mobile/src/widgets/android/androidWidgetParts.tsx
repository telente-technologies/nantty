import { FlexWidget, ImageWidget, TextWidget } from "react-native-android-widget";

import type { WidgetPalette } from "../widgetPresentation.util";

interface ShellProps {
  readonly palette: WidgetPalette;
  readonly deepLink: string;
  readonly children: unknown;
}

export function AndroidWidgetShell({ palette, deepLink, children }: ShellProps) {
  return (
    <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: deepLink }}
      style={{ height: "match_parent", width: "match_parent", backgroundColor: palette.background, borderRadius: 22, padding: 14, flexDirection: "column", justifyContent: "space-between" }}>
      {children}
    </FlexWidget>
  );
}

export function AndroidWidgetHeader({ palette, title }: { readonly palette: WidgetPalette; readonly title: string }) {
  return (
    <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: "match_parent" }}>
      <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.brand, marginRight: 6 }} />
      <TextWidget text={title} style={{ fontSize: 12, fontWeight: "600", color: palette.muted }} />
    </FlexWidget>
  );
}

export function AndroidWidgetMessage({ palette, deepLink, title, message }: { readonly palette: WidgetPalette; readonly deepLink: string; readonly title: string; readonly message: string }) {
  return (
    <AndroidWidgetShell palette={palette} deepLink={deepLink}>
      <AndroidWidgetHeader palette={palette} title={title} />
      <TextWidget text={message} maxLines={3} style={{ fontSize: 15, fontWeight: "600", color: palette.text }} />
    </AndroidWidgetShell>
  );
}

export function AndroidWidgetAvatar({ uri, size, ringColor }: { readonly uri: string | null; readonly size: number; readonly ringColor: `#${string}` }) {
  return (
    <FlexWidget style={{ width: size + 6, height: size + 6, borderRadius: (size + 6) / 2, borderWidth: 2, borderColor: ringColor, alignItems: "center", justifyContent: "center" }}>
      {uri !== null && uri.startsWith("https:")
        ? <ImageWidget image={uri as `https:${string}`} imageWidth={size} imageHeight={size} radius={size / 2} />
        : <FlexWidget style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: ringColor }} />}
    </FlexWidget>
  );
}

export function AndroidWidgetStat({ palette, label, value }: { readonly palette: WidgetPalette; readonly label: string; readonly value: string }) {
  return (
    <FlexWidget style={{ flexDirection: "column", flex: 1 }}>
      <TextWidget text={value} maxLines={1} style={{ fontSize: 18, fontWeight: "700", color: palette.text }} />
      <TextWidget text={label} maxLines={1} style={{ fontSize: 11, color: palette.muted }} />
    </FlexWidget>
  );
}
