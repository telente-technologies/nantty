import { Pressable, StyleSheet, View } from "react-native";

import { Bell24Icon, BellRinging24Icon, BellSlash24Icon, Check16Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { PostNotificationLevel } from "@/types/socialGraph.type";

const CHOICES: readonly { readonly level: PostNotificationLevel; readonly label: string; readonly hint: string }[] = [
  { level: "posts", label: "All posts", hint: "Posts and clips" },
  { level: "posts_and_lives", label: "Lives too", hint: "Also notify me when they go live" },
  { level: "off", label: "Off", hint: "No post notifications" },
];

export function PostNotificationLevelIcon({ level, size = 20, color }: { readonly level: PostNotificationLevel; readonly size?: number; readonly color?: string }) {
  if (level === "posts_and_lives") return <BellRinging24Icon size={size} color={color} />;
  if (level === "posts") return <Bell24Icon size={size} color={color} />;
  return <BellSlash24Icon size={size} color={color} />;
}

export interface PostNotificationsSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly username: string;
  readonly level: PostNotificationLevel;
  readonly onSelect: (level: PostNotificationLevel) => void;
}

export function PostNotificationsSheet({ visible, onClose, username, level, onSelect }: PostNotificationsSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Get notified when @${username} posts`}>
      <View style={styles.list}>
        {CHOICES.map((choice) => {
          const selected = choice.level === level;
          return (
            <Pressable
              key={choice.level}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${choice.label}. ${choice.hint}`}
              onPress={() => {
                onClose();
                if (!selected) onSelect(choice.level);
              }}
              style={styles.row}
            >
              <PostNotificationLevelIcon level={choice.level} color={selected ? colors.primary : colors.textMuted} />
              <View style={styles.copy}>
                <Text size={15} lineHeight={20} color={selected ? colors.primary : colors.text}>{choice.label}</Text>
                <Text size={13} lineHeight={17} color={colors.textMuted}>{choice.hint}</Text>
              </View>
              {selected ? <Check16Icon color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.divider },
  copy: { flex: 1, gap: 2 },
}));
