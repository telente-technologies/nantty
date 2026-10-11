import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Check16Icon, Warning20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { useToastStore } from "@/store/toast.store";
import { makeThemedStyles, useTheme } from "@/theme";

import { modalMotion } from "./modalChrome.constant";

export function ToastHost() {
  const message = useToastStore((state) => state.message);
  const action = useToastStore((state) => state.action);
  const dismissToast = useToastStore((state) => state.dismissToast);
  const tone = useToastStore((state) => state.tone);
  const toastId = useToastStore((state) => state.toastId);
  const styles = useStyles();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  if (!message) return null;
  const ink = isDark ? "#0A0A14" : "#FFFFFF";
  const toneInk = tone === "success" ? (isDark ? "#067A55" : "#6EE7B7") : tone === "error" ? (isDark ? "#B91C1C" : "#FCA5A5") : ink;
  const actionInk = isDark ? "#4F46E5" : "#A5B4FC";
  return (
    <View pointerEvents={action ? "box-none" : "none"} style={[styles.host, { bottom: insets.bottom + 72 }]} accessibilityLiveRegion="polite">
      <Animated.View
        key={toastId}
        entering={reduceMotion ? undefined : FadeInDown.duration(modalMotion.enterMs)}
        exiting={reduceMotion ? undefined : FadeOut.duration(modalMotion.exitMs)}
        style={styles.toast}
        accessibilityRole={tone === "error" ? "alert" : undefined}
      >
        {tone === "success" ? <Check16Icon color={toneInk} /> : null}
        {tone === "error" ? <Warning20Icon size={16} color={toneInk} /> : null}
        <Text size={14} lineHeight={19} weight={500} color={ink} style={styles.text} maxFontSizeMultiplier={1.6}>
          {message}
        </Text>
        {action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={6}
            style={styles.action}
            onPress={() => {
              dismissToast();
              action.onPress();
            }}
          >
            <Text size={14} lineHeight={19} weight={700} color={actionInk}>
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors, scheme) =>
  StyleSheet.create({
    host: { position: "absolute", left: 16, right: 16, alignItems: "center" },
    toast: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: scheme === "dark" ? "#F2F3F8" : "#16182A",
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      maxWidth: 400,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: scheme === "dark" ? 0 : 0.18,
      shadowRadius: 20,
      elevation: scheme === "dark" ? 0 : 8,
    },
    text: { flexShrink: 1 },
    action: { minHeight: 44, marginVertical: -12, paddingHorizontal: 6, justifyContent: "center" },
  }),
);
