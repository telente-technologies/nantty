import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { MainStackParamList } from "@/navigation/navigation.types";
import { makeThemedStyles } from "@/theme";
import type { CommentVideoReply } from "@/types";

export function VideoReplyChip({ reply }: { readonly reply: CommentVideoReply }) {
  const styles = useStyles();
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Replied with video, open the reply"
      onPress={() => navigation.navigate("PostDetail", { postId: reply.clipId })}
      style={styles.chip}
    >
      {reply.thumbnailUrl ? <Image source={{ uri: reply.thumbnailUrl }} style={styles.thumb} /> : <View style={styles.thumb} />}
      <Text size={11} weight={600} lineHeight={14.4}>
        Replied with video
      </Text>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, paddingRight: 10, borderRadius: 14, backgroundColor: colors.chip, overflow: "hidden" },
  thumb: { width: 28, height: 28, backgroundColor: colors.sunken },
}));
