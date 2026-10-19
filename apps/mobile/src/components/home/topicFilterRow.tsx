import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Check16Icon } from "@/components/icons";
import { Chip } from "@/components/ui/chip";
import { FrameAwareModal } from "@/components/ui/frameAwareModal";
import { buildPopoverMenuSurface } from "@/components/ui/modalChrome.constant";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Topic } from "@/types";
import { horizontalScrollGestureGuardProps } from "@/components/home/horizontalScrollGestureGuard.util";

export type FeedMode = "for-you" | "following";

export interface TopicFilterRowProps {
  readonly topics: readonly Topic[];
  readonly selectedTopicId: string | null;
  readonly feedMode: FeedMode;
  readonly onSelectTopic: (topicId: string | null) => void;
  readonly onSelectMode: (mode: FeedMode) => void;
}

export function TopicFilterRow({ topics, selectedTopicId, feedMode, onSelectTopic, onSelectMode }: TopicFilterRowProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const selectMode = (mode: FeedMode) => {
    setIsModeMenuOpen(false);
    onSelectMode(mode);
  };
  return (
    <View>
      <ScrollView horizontal {...horizontalScrollGestureGuardProps} showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={styles.content}>
        <Chip
          kind="filter"
          label={feedMode === "following" ? "Following" : "For You"}
          dropdown
          selected={feedMode === "for-you" && selectedTopicId === null}
          onPress={() => setIsModeMenuOpen(true)}
        />
        {topics.map((topic) => (
          <Chip
            key={topic.id}
            kind="filter"
            label={topic.name}
            selected={selectedTopicId === topic.id}
            onPress={() => onSelectTopic(topic.id)}
          />
        ))}
      </ScrollView>
      <FrameAwareModal visible={isModeMenuOpen} transparent animationType="fade" onRequestClose={() => setIsModeMenuOpen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close menu" style={styles.menuBackdrop} onPress={() => setIsModeMenuOpen(false)}>
          <View style={[styles.menu, { marginTop: insets.top + 89 }]} accessibilityRole="menu">
            <ModeMenuItem label="For you" selected={feedMode === "for-you"} onPress={() => selectMode("for-you")} />
            <ModeMenuItem label="Following" selected={feedMode === "following"} onPress={() => selectMode("following")} />
          </View>
        </Pressable>
      </FrameAwareModal>
    </View>
  );
}

function ModeMenuItem({ label, selected, onPress }: { readonly label: string; readonly selected: boolean; readonly onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="menuitem" accessibilityState={{ selected }} onPress={onPress} style={styles.menuItem}>
      <Text size={14} lineHeight={18} weight={selected ? 600 : 400}>
        {label}
      </Text>
      {selected ? <Check16Icon color={colors.primary} /> : null}
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => StyleSheet.create({
  row: { flexGrow: 0, backgroundColor: colors.surface },
  content: { paddingTop: 12, paddingBottom: 12, paddingLeft: 16, paddingRight: 16, gap: 8 },
  menuBackdrop: { flex: 1 },
  menu: { marginLeft: 16, alignSelf: "flex-start", ...buildPopoverMenuSurface(colors, scheme) },
  menuItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48, paddingHorizontal: 16, gap: 12 },
}));
