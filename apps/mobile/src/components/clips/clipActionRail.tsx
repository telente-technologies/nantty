import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { SaveToggleButton } from "@/components/saves/saveToggleButton";
import { Text } from "@/components/ui/text";
import { usePostActionTint } from "@/components/feed/postActionButton";
import { DotsThreeVertical24Icon, GiftActionIcon, LikeActionIcon, ReplyActionIcon, SendActionIcon } from "@/components/icons";
import type { SaveTarget } from "@/types";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

const RAIL_ICON_SIZE = 26;

export interface ClipActionRailProps {
  readonly liked: boolean;
  readonly likes: number;
  readonly comments: number;
  readonly shares: number;
  readonly onToggleLike: () => void;
  readonly onOpenComments: () => void;
  readonly onShare: () => void;
  readonly onMore: () => void;
  readonly onTip?: () => void;
  readonly saveTarget?: SaveTarget;
  readonly savedAccordingToServer?: boolean;
  readonly saveCount?: number;
  readonly foregroundColor?: string;
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
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${count}`} hitSlop={{ top: 11, bottom: 11, left: 6, right: 6 }} onPress={onPress} style={styles.button}>
      {children}
      <Text size={13} lineHeight={16.9} color={foregroundColor} style={foregroundColor ? styles.readableOnVideo : undefined}>
        {formatCountWithThousandsSuffix(count)}
      </Text>
    </Pressable>
  );
}

export function ClipActionRail(props: ClipActionRailProps) {
  const color = props.foregroundColor;
  const likeTint = usePostActionTint("like");
  return (
    <View style={styles.rail}>
      <RailButton label={props.liked ? "Unlike" : "Like"} count={props.likes} onPress={props.onToggleLike} foregroundColor={color}>
        <LikeActionIcon size={RAIL_ICON_SIZE} color={props.liked ? likeTint : color} filled={props.liked} />
      </RailButton>
      <RailButton label="Comments" count={props.comments} onPress={props.onOpenComments} foregroundColor={color}>
        <ReplyActionIcon size={RAIL_ICON_SIZE} color={color} />
      </RailButton>
      <RailButton label="Share" count={props.shares} onPress={props.onShare} foregroundColor={color}>
        <SendActionIcon size={RAIL_ICON_SIZE} color={color} />
      </RailButton>
      {props.saveTarget ? (
        <SaveToggleButton target={props.saveTarget} savedAccordingToServer={props.savedAccordingToServer ?? false} foregroundColor={color} saveCount={props.saveCount ?? 0} />
      ) : null}
      {props.onTip ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Tip this creator with coins" hitSlop={{ top: 11, bottom: 11, left: 6, right: 6 }} onPress={props.onTip} style={styles.button}>
          <GiftActionIcon size={RAIL_ICON_SIZE} color={color} />
          <Text size={13} lineHeight={16.9} color={color} style={color ? styles.readableOnVideo : undefined}>
            Tip
          </Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel="More options" hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }} onPress={props.onMore}>
        <DotsThreeVertical24Icon size={22} color={color} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { width: 32, gap: 20, alignItems: "center" },
  button: { width: 32, gap: 4, alignItems: "center" },
  readableOnVideo: { textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
});
