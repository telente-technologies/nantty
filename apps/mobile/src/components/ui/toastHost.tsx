import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { useToastStore } from "@/store/toast.store";
import { makeThemedStyles, useTheme } from "@/theme";

export function ToastHost() {
  const message = useToastStore((state) => state.message);
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (!message) return null;
  return (
    <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + 72 }]} accessibilityLiveRegion="polite">
      <View style={styles.toast}>
        <Text size={13} lineHeight={16.9} weight={500} color={colors.background}>{message}</Text>
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  host: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: { backgroundColor: colors.text, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, maxWidth: 360 },
}));
