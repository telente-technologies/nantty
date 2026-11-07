import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Frame30132Icon } from "@/components/icons";
import { LiveAvatarRing } from "@/components/live/liveAvatarRing";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { StoryTrayItem, SuggestedLive, UserSummary } from "@/types";

export interface StoryTrayProps {
  readonly items: readonly StoryTrayItem[];
  readonly liveItems?: readonly SuggestedLive[];
  readonly myAvatarUrl: string | null;
  readonly onPressAddStory: () => void;
  readonly onPressStory: (userId: string) => void;
  readonly onPressLive: (liveId: string) => void;
}

const sortLiveCreatorsFirst = (items: readonly StoryTrayItem[]) =>
  [...items].sort((left, right) => Number(Boolean(right.user.live)) - Number(Boolean(left.user.live)));

export function StoryTray({ items, liveItems = [], myAvatarUrl, onPressAddStory, onPressStory, onPressLive }: StoryTrayProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const activeLives = new Map<string, { readonly id: string; readonly host: UserSummary }>(liveItems.map((live) => [live.host.id, { id: live.id, host: live.host }]));
  for (const item of items) {
    if (item.user.live && !activeLives.has(item.user.id)) {
      activeLives.set(item.user.id, {
        id: item.user.live.liveId,
        host: item.user,
      });
    }
  }
  const liveHostIds = new Set(activeLives.keys());
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Add story" onPress={onPressAddStory} style={styles.item}>
        <View style={styles.bubble}>
          <Avatar uri={myAvatarUrl} size={60} placeholderColor={colors.primaryTint} />
          <View style={styles.badge}>
            <Frame30132Icon />
          </View>
        </View>
        <Text size={11} weight={500} lineHeight={15.4} letterSpacing={0} align="center">
          Add Story
        </Text>
      </Pressable>
      {[...activeLives.values()].map((live) => (
        <Pressable
          key={`live-${live.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${live.host.name} is live, open livestream`}
          onPress={() => onPressLive(live.id)}
          style={styles.item}
        >
          <View style={styles.liveBubble}>
            <LiveAvatarRing size={50}>
              <Avatar uri={live.host.avatarUrl} size={50} />
            </LiveAvatarRing>
          </View>
          <Text size={13} weight={500} lineHeight={16.9} align="center" numberOfLines={1}>
            {live.host.name}
          </Text>
        </Pressable>
      ))}
      {sortLiveCreatorsFirst(items.filter((item) => !liveHostIds.has(item.user.id))).map((item) => (
          <Pressable
            key={item.user.id}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.user.name}'s story`}
            onPress={() => onPressStory(item.user.id)}
            style={styles.item}
          >
            <View style={styles.bubble}>
              <View style={[styles.ring, item.hasUnseen ? styles.ringUnseen : styles.ringSeen]} />
              <View style={styles.badge}>
                <Avatar uri={item.user.avatarUrl} size={32} />
              </View>
            </View>
            <Text size={13} weight={500} lineHeight={16.9} align="center" numberOfLines={1}>
              {item.user.name}
            </Text>
          </Pressable>
      ))}
    </ScrollView>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { paddingHorizontal: 16, gap: 12 },
  item: { width: 68, alignItems: "center", gap: 4 },
  bubble: { width: 68, height: 60 },
  liveBubble: { width: 68, height: 60, alignItems: "center", justifyContent: "center" },
  ring: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primaryTint },
  ringUnseen: { borderWidth: 2, borderColor: colors.primary },
  ringSeen: { borderWidth: 2, borderColor: colors.textFaint, backgroundColor: colors.placeholder },
  badge: { position: "absolute", right: 0, bottom: 0 },
}));
