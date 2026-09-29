import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ChatCircle24Icon, DotsThreeVertical24Icon, Heart24Icon, PaperPlaneTilt24Icon, HeartFill72Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

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
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${count}`} hitSlop={6} onPress={onPress} style={styles.button}>
      {children}
      <Text size={13} lineHeight={16.9} color={foregroundColor} style={foregroundColor ? styles.readableOnVideo : undefined}>
        {formatCountWithThousandsSuffix(count)}
      </Text>
    </Pressable>
  );
}

export function ClipActionRail(props: ClipActionRailProps) {
  const color = props.foregroundColor;
  return (
    <View style={styles.rail}>
      <RailButton label={props.liked ? "Unlike" : "Like"} count={props.likes} onPress={props.onToggleLike} foregroundColor={color}>
        {props.liked ? <HeartFill72Icon size={24} /> : <Heart24Icon color={color} />}
      </RailButton>
      <RailButton label="Comments" count={props.comments} onPress={props.onOpenComments} foregroundColor={color}>
        <ChatCircle24Icon color={color} />
      </RailButton>
      <RailButton label="Share" count={props.shares} onPress={props.onShare} foregroundColor={color}>
        <PaperPlaneTilt24Icon color={color} />
      </RailButton>
      {props.onTip ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Tip this creator with coins" hitSlop={8} onPress={props.onTip} style={styles.button}>
          <Text size={20} lineHeight={24}>
            🪙
          </Text>
          <Text size={13} lineHeight={16.9} color={color} style={color ? styles.readableOnVideo : undefined}>
            Tip
          </Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel="More options" hitSlop={8} onPress={props.onMore}>
        <DotsThreeVertical24Icon color={color} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { width: 32, gap: 16, alignItems: "center" },
  button: { width: 32, gap: 4, alignItems: "center" },
  readableOnVideo: { textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
});
