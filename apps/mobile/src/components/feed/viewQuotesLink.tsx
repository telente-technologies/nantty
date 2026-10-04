import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/ui/text";
import type { MainStackParamList } from "@/navigation/navigation.types";
import { useTheme } from "@/theme";
import type { Post } from "@/types";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

export function ViewQuotesLink({ post }: { readonly post: Post }) {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const quotes = post.quotes ?? 0;
  if (quotes <= 0) return null;
  const label = `View quotes (${formatCountWithThousandsSuffix(quotes)})`;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => navigation.navigate("PostQuotes", { postId: post.id })} hitSlop={6} style={styles.link}>
      <Text size={13} weight={500} lineHeight={18} color={colors.primary}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({ link: { alignSelf: "flex-start", marginHorizontal: 16, minHeight: 32, justifyContent: "center" } });
