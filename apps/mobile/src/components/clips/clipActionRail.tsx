import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { SaveToggleButton } from "@/components/saves/saveToggleButton";
import { Text } from "@/components/ui/text";
import { usePostActionTint } from "@/components/feed/postActionButton";
import { DotsThreeVertical24Icon, GiftActionIcon, LikeActionIcon, ReplyActionIcon, ShareActionIcon, ViewsActionIcon } from "@/components/icons";
import type { SaveTarget } from "@/types";
import { formatCompactCount } from "@/utils/formatCount.util";

import { RAIL_ITEM_WIDTH, clipRailStyles } from "./clipRail.constant";

const RAIL_ICON_SIZE = 26;
const noop = () => undefined;

export interface ClipActionRailProps {
  readonly liked: boolean;
  readonly likes: number;
  readonly comments: number;
  readonly shares: number;
  readonly views: number;
  readonly onToggleLike: () => void;
  readonly onOpenComments: () => void;
  readonly onShare: () => void;
  readonly onMore: () => void;
  readonly onPressViews?: () => void;
  readonly isOwnClip?: boolean;
  readonly onTip?: () => void;
  readonly saveTarget?: SaveTarget;
  readonly savedAccordingToServer?: boolean;
  readonly saveCount?: number;
  readonly foregroundColor?: string;
  readonly minimal?: boolean;
}

function RailButton({
  label,
  count,
  onPress,
  foregroundColor,
  children,
}: {
  label: string;
  count: number;
  onPress: () => void;
  foregroundColor?: string;
  children: ReactNode;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${count}`} hitSlop={{ top: 11, bottom: 11 }} onPress={onPress} style={clipRailStyles.item}>
      {children}
      <Text size={13} lineHeight={16.9} color={foregroundColor} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[clipRailStyles.count, foregroundColor ? clipRailStyles.readableOnVideo : null]}>
        {formatCompactCount(count)}
      </Text>
    </Pressable>
  );
}

export function ClipActionRail(props: ClipActionRailProps) {
  const color = props.foregroundColor;
  const likeTint = usePostActionTint("like");
  if (props.minimal) {
    return (
      <View style={styles.rail}>
        <Pressable accessibilityRole="button" accessibilityLabel="More options" hitSlop={{ top: 11, bottom: 11 }} onPress={props.onMore} style={clipRailStyles.item}>
          <DotsThreeVertical24Icon size={22} color={color} />
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.rail}>
      <RailButton label={props.liked ? "Unlike" : "Like"} count={props.likes} onPress={props.onToggleLike} foregroundColor={color}>
        <LikeActionIcon size={RAIL_ICON_SIZE} color={props.liked ? likeTint : color} filled={props.liked} />
      </RailButton>
      <RailButton label="Comments" count={props.comments} onPress={props.onOpenComments} foregroundColor={color}>
        <ReplyActionIcon size={RAIL_ICON_SIZE} color={color} />
      </RailButton>
      <RailButton label="Share" count={props.shares} onPress={props.onShare} foregroundColor={color}>
        <ShareActionIcon size={RAIL_ICON_SIZE} color={color} />
      </RailButton>
      {props.saveTarget ? (
        <SaveToggleButton target={props.saveTarget} savedAccordingToServer={props.savedAccordingToServer ?? false} foregroundColor={color} saveCount={props.saveCount ?? 0} />
      ) : null}
      <RailButton label={props.isOwnClip ? "Views, open clip analytics" : "Views, what are views"} count={props.views} onPress={props.onPressViews ?? noop} foregroundColor={color}>
        <ViewsActionIcon size={RAIL_ICON_SIZE} color={color} />
      </RailButton>
      {props.onTip ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Tip this creator with coins" hitSlop={{ top: 11, bottom: 11 }} onPress={props.onTip} style={clipRailStyles.item}>
          <GiftActionIcon size={RAIL_ICON_SIZE} color={color} />
          <Text size={13} lineHeight={16.9} color={color} numberOfLines={1} style={[clipRailStyles.count, color ? clipRailStyles.readableOnVideo : null]}>
            Tip
          </Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel="More options" hitSlop={{ top: 11, bottom: 11 }} onPress={props.onMore} style={clipRailStyles.item}>
        <DotsThreeVertical24Icon size={22} color={color} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { width: RAIL_ITEM_WIDTH, gap: 20, alignItems: "center" },
});
