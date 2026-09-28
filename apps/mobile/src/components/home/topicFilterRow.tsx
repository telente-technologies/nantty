import { ScrollView, StyleSheet } from "react-native";

import { Chip } from "@/components/ui/chip";
import { colors } from "@/constants/colors.constant";
import type { Topic } from "@/types";

export interface TopicFilterRowProps {
  readonly topics: readonly Topic[];
  readonly selectedTopicId: string | null;
  readonly onSelectTopic: (topicId: string | null) => void;
}

export function TopicFilterRow({ topics, selectedTopicId, onSelectTopic }: TopicFilterRowProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={styles.content}>
      <Chip kind="filter" label="For You" dropdown selected={selectedTopicId === null} onPress={() => onSelectTopic(null)} />
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
  );
}

const styles = StyleSheet.create({
  row: { flexGrow: 0, backgroundColor: colors.white },
  content: { paddingTop: 12, paddingBottom: 12, paddingLeft: 16, paddingRight: 16, gap: 8 },
});
