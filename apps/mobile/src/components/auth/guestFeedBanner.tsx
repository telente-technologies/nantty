import { Pressable, StyleSheet, View } from "react-native";

import { Cancel20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { useAuthStore } from "@/store/auth.store";
import { useGuestSessionStore } from "@/store/guestSession.store";
import { makeThemedStyles, useTheme } from "@/theme";
import { openAuthFlowThenReturn } from "@/utils/requireAuth.util";

export function GuestFeedBanner() {
  const styles = useStyles();
  const { colors } = useTheme();
  const isSignedIn = useAuthStore((s) => s.status === "signedIn");
  const isDismissed = useGuestSessionStore((s) => s.hasDismissedGuestFeedBanner);
  const dismiss = useGuestSessionStore((s) => s.dismissGuestFeedBanner);
  if (isSignedIn || isDismissed) return null;
  return (
    <View style={styles.banner}>
      <Pressable accessibilityRole="button" style={styles.message} onPress={() => openAuthFlowThenReturn("signup")}>
        <Text size={13} weight={500} color={colors.primary}>
          Sign in to like, follow and shop
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={12} onPress={dismiss}>
        <Cancel20Icon />
      </Pressable>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  banner: {
    minHeight: 36,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  message: { flex: 1, paddingVertical: 8 },
}));
