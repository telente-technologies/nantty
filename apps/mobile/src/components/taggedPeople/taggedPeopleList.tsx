import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { useTheme } from "@/theme";
import type { Post } from "@/types";

import { useTaggedPeople } from "./taggedPeople.hook";
import { TaggedPersonRow } from "./taggedPersonRow";

export interface TaggedPeopleListProps {
  readonly post: Pick<Post, "id" | "taggedUsers" | "taggedUsersCount">;
  readonly visible: boolean;
  readonly onClose: () => void;
}

export function TaggedPeopleList({ post, visible, onClose }: TaggedPeopleListProps) {
  const { colors } = useTheme();
  const openUserProfile = useOpenUserProfile();
  const { people, hasMore, isLoadingMore, isError, loadMore } = useTaggedPeople(post, visible);
  const openProfile = (userId: string) => {
    onClose();
    openUserProfile(userId);
  };
  return (
    <View style={styles.list} accessibilityRole="list">
      {people.map((person) => (
        <TaggedPersonRow key={person.id} person={person} onPress={() => openProfile(person.id)} closeContainer={onClose} />
      ))}
      {isLoadingMore ? <ActivityIndicator color={colors.primary} style={styles.more} accessibilityLabel="Loading tagged people" /> : null}
      {!isLoadingMore && hasMore ? (
        <Pressable accessibilityRole="button" onPress={loadMore} style={styles.more} hitSlop={8}>
          <Text size={14} weight={600} color={colors.primary} align="center">
            {isError ? "Couldn't load everyone. Try again" : "Show more"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { alignSelf: "stretch" },
  more: { minHeight: 44, justifyContent: "center", marginTop: 4 },
});
