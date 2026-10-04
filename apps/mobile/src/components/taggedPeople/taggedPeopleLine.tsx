import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { PersonTag24Icon } from "@/components/icons";
import { Dialog } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { Post } from "@/types";
import { formatTaggedPeopleSummary } from "@/utils/formatCount.util";

import { countTaggedPeople } from "./taggedPeople.hook";
import { TaggedPeopleList } from "./taggedPeopleList";

export function TaggedPeopleLine({ post }: { readonly post: Pick<Post, "id" | "taggedUsers" | "taggedUsersCount"> }) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const first = post.taggedUsers?.[0];
  const total = countTaggedPeople(post);
  if (!first || total === 0) return null;
  const summary = formatTaggedPeopleSummary(first.displayName, total);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Tagged: ${summary}`}
        accessibilityHint="Shows everyone tagged in this post"
        onPress={() => setIsOpen(true)}
        hitSlop={{ top: 8, bottom: 8 }}
        style={({ pressed }) => [styles.line, pressed ? { opacity: 0.6 } : null]}
      >
        <PersonTag24Icon size={16} color={colors.textMuted} />
        <Text size={13} weight={500} lineHeight={17} color={colors.textMuted} numberOfLines={1} style={styles.label}>
          {summary}
        </Text>
      </Pressable>
      <Dialog visible={isOpen} onClose={() => setIsOpen(false)} title="Tagged in this post" actions={[{ label: "Close", style: "secondary", onPress: () => setIsOpen(false) }]}>
        <TaggedPeopleList post={post} visible={isOpen} onClose={() => setIsOpen(false)} />
      </Dialog>
    </>
  );
}

const styles = StyleSheet.create({
  line: { alignSelf: "flex-start", maxWidth: "100%", minHeight: 28, marginHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 6 },
  label: { flexShrink: 1 },
});
