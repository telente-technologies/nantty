import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

export interface SubscriberPostsGateProps {
  readonly username: string;
  readonly subscriptionAvailable: boolean;
  readonly onSubscribe?: () => void;
}

export function SubscriberPostsGate({ username, subscriptionAvailable, onSubscribe }: SubscriberPostsGateProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.root}>
      <Text accessibilityRole="header" size={27} weight={700} lineHeight={32}>
        Unlock more with subscriptions
      </Text>
      <Text size={16} lineHeight={21} color={colors.textMuted}>
        @{username} shares subscriber-only posts and videos. Subscribe to see their exclusive posts and bonus content.
      </Text>
      {subscriptionAvailable && onSubscribe ? (
        <Pressable accessibilityRole="button" onPress={onSubscribe} style={styles.subscribeButton}>
          <Text size={15} weight={600} lineHeight={20} color={colors.background}>Subscribe</Text>
        </Pressable>
      ) : (
        <Text size={14} lineHeight={19} color={colors.textMuted}>
          Subscriptions aren’t available right now.
        </Text>
      )}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { paddingHorizontal: 22, paddingTop: 40, paddingBottom: 36, gap: 16 },
  subscribeButton: { alignSelf: "flex-start", minHeight: 50, justifyContent: "center", paddingHorizontal: 30, marginTop: 12, borderRadius: 25, backgroundColor: colors.text },
}));
