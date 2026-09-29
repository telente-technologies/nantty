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
}

function RailButton({ label, count, onPress, children }: { label: string; count: number; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${count}`} hitSlop={6} onPress={onPress} style={styles.button}>
      {children}
      <Text size={13} lineHeight={16.9}>
        {formatCountWithThousandsSuffix(count)}
      </Text>
    </Pressable>
  );
}

export function ClipActionRail(props: ClipActionRailProps) {
  return (
    <View style={styles.rail}>
      <RailButton label={props.liked ? "Unlike" : "Like"} count={props.likes} onPress={props.onToggleLike}>
        {props.liked ? <HeartFill72Icon size={24} /> : <Heart24Icon />}
      </RailButton>
      <RailButton label="Comments" count={props.comments} onPress={props.onOpenComments}>
        <ChatCircle24Icon />
      </RailButton>
      <RailButton label="Share" count={props.shares} onPress={props.onShare}>
        <PaperPlaneTilt24Icon />
      </RailButton>
      <Pressable accessibilityRole="button" accessibilityLabel="More options" hitSlop={8} onPress={props.onMore}>
        <DotsThreeVertical24Icon />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { width: 32, gap: 16, alignItems: "center" },
  button: { width: 32, gap: 4, alignItems: "center" },
});
