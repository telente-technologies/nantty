import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { ID } from "@/types";
import { LockSimpleFill24Icon } from "@/components/icons";

type NavigationThatMayKnowCreatorSubscribe = {
  getState: () => { routeNames?: readonly string[] } | undefined;
  navigate: (routeName: string, params?: object) => void;
};

export function openCreatorSubscriptionPage(navigation: unknown, creatorId: ID) {
  const navigator = navigation as NavigationThatMayKnowCreatorSubscribe;
  const knownRouteNames = navigator.getState()?.routeNames ?? [];
  if (knownRouteNames.includes("CreatorSubscribe")) navigator.navigate("CreatorSubscribe", { creatorId });
  else navigator.navigate("UserProfile", { userId: creatorId });
}

export const isContentLockedForViewer = (content: { subscriberOnly?: boolean; viewerHasAccess?: boolean }) =>
  content.subscriberOnly === true && content.viewerHasAccess === false;

export interface SubscriberOnlyLockProps {
  readonly creatorId: ID;
  readonly creatorName: string;
  readonly blurredPreviewUrl?: string | null;
}

export function SubscriberOnlyLock({ creatorId, creatorName, blurredPreviewUrl }: SubscriberOnlyLockProps) {
  const navigation = useNavigation();
  return (
    <View style={styles.cover}>
      {blurredPreviewUrl ? (
        <Image source={{ uri: blurredPreviewUrl }} blurRadius={40} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      ) : null}
      <View style={styles.dim} pointerEvents="none" />
      <LockSimpleFill24Icon size={28} color={colors.white} />
      <Text size={14} weight={600} lineHeight={16.8} color={colors.white} align="center">
        For {creatorName}'s subscribers
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Subscribe to ${creatorName} to see this`}
        onPress={() => openCreatorSubscriptionPage(navigation, creatorId)}
        style={styles.button}
      >
        <Text size={14} weight={500} lineHeight={16.8} color={colors.white}>
          Subscribe to see this
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.media,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  button: { height: 36, paddingHorizontal: 16, borderRadius: 4, backgroundColor: colors.primary, justifyContent: "center" },
});
