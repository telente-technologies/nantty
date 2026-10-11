import { FlexWidget, TextWidget } from "react-native-android-widget";

import type { CreatorTodayWidgetPayload, LiveNowWidgetPayload, StoriesWidgetPayload } from "@/types/widget.type";

import { widgetAmountText, widgetCompactCount, type WidgetPalette, type WidgetSize } from "../widgetPresentation.util";
import { AndroidWidgetAvatar, AndroidWidgetHeader, AndroidWidgetMessage, AndroidWidgetShell, AndroidWidgetStat } from "./androidWidgetParts";

const storiesPerSize: Readonly<Record<WidgetSize, number>> = { small: 1, medium: 4, large: 8 };

export function StoriesAndroidWidget({ payload, palette, size }: { readonly payload: StoriesWidgetPayload; readonly palette: WidgetPalette; readonly size: WidgetSize }) {
  const people = payload.people.slice(0, storiesPerSize[size]);
  const first = people[0];
  if (first === undefined) return <AndroidWidgetMessage palette={palette} deepLink="zudomart://" title="Stories" message="No new stories from people you follow." />;
  if (size === "small") {
    return (
      <AndroidWidgetShell palette={palette} deepLink={first.deepLink}>
        <AndroidWidgetHeader palette={palette} title="Stories" />
        <AndroidWidgetAvatar uri={first.avatarUrl} size={56} ringColor={first.hasUnseen ? palette.ring : palette.seenRing} />
        <TextWidget text={first.name} maxLines={1} style={{ fontSize: 13, fontWeight: "600", color: palette.text }} />
      </AndroidWidgetShell>
    );
  }
  const rows = size === "large" ? [people.slice(0, 4), people.slice(4, 8)] : [people];
  return (
    <AndroidWidgetShell palette={palette} deepLink="zudomart://">
      <AndroidWidgetHeader palette={palette} title="Stories" />
      {rows.map((row, index) => (
        <FlexWidget key={`row-${index}`} style={{ flexDirection: "row", width: "match_parent", justifyContent: "space-between" }}>
          {row.map((person) => (
            <FlexWidget key={person.userId} clickAction="OPEN_URI" clickActionData={{ uri: person.deepLink }} style={{ flexDirection: "column", alignItems: "center", width: 68 }}>
              <AndroidWidgetAvatar uri={person.avatarUrl} size={48} ringColor={person.hasUnseen ? palette.ring : palette.seenRing} />
              <TextWidget text={person.name} maxLines={1} style={{ fontSize: 11, color: palette.text }} />
            </FlexWidget>
          ))}
        </FlexWidget>
      ))}
    </AndroidWidgetShell>
  );
}

export function LiveNowAndroidWidget({ payload, palette, size }: { readonly payload: LiveNowWidgetPayload; readonly palette: WidgetPalette; readonly size: WidgetSize }) {
  const lives = payload.lives.slice(0, size === "small" ? 1 : 3);
  const first = lives[0];
  if (first === undefined) return <AndroidWidgetMessage palette={palette} deepLink="zudomart://" title="Live now" message="No one you follow is live." />;
  return (
    <AndroidWidgetShell palette={palette} deepLink={first.deepLink}>
      <AndroidWidgetHeader palette={palette} title="Live now" />
      {lives.map((live) => (
        <FlexWidget key={live.id} clickAction="OPEN_URI" clickActionData={{ uri: live.deepLink }} style={{ flexDirection: "row", alignItems: "center", width: "match_parent", marginTop: 4 }}>
          <AndroidWidgetAvatar uri={live.hostAvatarUrl} size={size === "small" ? 40 : 32} ringColor={palette.live} />
          <FlexWidget style={{ flexDirection: "column", flex: 1, marginLeft: 8 }}>
            <TextWidget text={live.hostName} maxLines={1} style={{ fontSize: 13, fontWeight: "700", color: palette.text }} />
            <TextWidget text={`${widgetCompactCount(live.viewers)} watching`} maxLines={1} style={{ fontSize: 11, color: palette.muted }} />
          </FlexWidget>
        </FlexWidget>
      ))}
    </AndroidWidgetShell>
  );
}

export function CreatorTodayAndroidWidget({ payload, palette, size }: { readonly payload: CreatorTodayWidgetPayload; readonly palette: WidgetPalette; readonly size: WidgetSize }) {
  if (!payload.creatorProgramMember) return <AndroidWidgetMessage palette={palette} deepLink={payload.deepLink} title="Creator stats" message="Join the Creator Program to see your stats." />;
  return (
    <AndroidWidgetShell palette={palette} deepLink={payload.deepLink}>
      <AndroidWidgetHeader palette={palette} title="Today" />
      <AndroidWidgetStat palette={palette} label="Views" value={widgetCompactCount(payload.viewsToday)} />
      <FlexWidget style={{ flexDirection: "row", width: "match_parent" }}>
        <AndroidWidgetStat palette={palette} label="New followers" value={widgetCompactCount(payload.newFollowersToday)} />
        {size !== "small" ? <AndroidWidgetStat palette={palette} label="Earnings" value={widgetAmountText(payload.earningsToday, payload.amountsHidden)} /> : null}
      </FlexWidget>
    </AndroidWidgetShell>
  );
}
