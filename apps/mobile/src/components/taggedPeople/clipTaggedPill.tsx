import { Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { mediaGlass } from "@/components/ui/modalChrome.constant";
import type { Post } from "@/types";
import { formatCompactCount, formatTaggedPeopleSummary } from "@/utils/formatCount.util";

import { countTaggedPeople } from "./taggedPeople.hook";

const MINI_AVATAR = 18;
const MINI_OVERLAP = 11;
const MAXIMUM_MINI_AVATARS = 3;

export function ClipTaggedPill({ post, onPress }: { readonly post: Pick<Post, "taggedUsers" | "taggedUsersCount">; readonly onPress: () => void }) {
  const people = post.taggedUsers ?? [];
  const total = countTaggedPeople(post);
  if (people.length === 0 || total === 0) return null;
  const visible = people.slice(0, MAXIMUM_MINI_AVATARS);
  const label = total === 1 ? people[0]!.displayName : `${formatCompactCount(total)} people`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Tagged: ${formatTaggedPeopleSummary(people[0]!.displayName, total)}`}
      accessibilityHint="Shows everyone tagged in this clip"
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8 }}
      style={({ pressed }) => [styles.pill, pressed ? styles.pressed : null]}
    >
      <View style={{ width: MINI_AVATAR + MINI_OVERLAP * (visible.length - 1), height: MINI_AVATAR }}>
        {visible.map((person, index) => (
          <Avatar key={person.id} uri={person.avatarUrl} size={MINI_AVATAR} style={[styles.mini, { left: index * MINI_OVERLAP, zIndex: MAXIMUM_MINI_AVATARS - index }]} />
        ))}
      </View>
      <Text size={12} weight={600} lineHeight={16} color={mediaGlass.ink} numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingLeft: 5,
    paddingRight: 11,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: mediaGlass.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mediaGlass.border,
  },
  pressed: { backgroundColor: mediaGlass.backgroundStrong },
  mini: { position: "absolute", top: 0, borderWidth: 1.5, borderColor: "rgba(12, 12, 18, 0.9)" },
  label: { flexShrink: 1 },
});
