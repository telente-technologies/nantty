import { useEffect, useRef, type ReactElement } from "react";
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Text } from "@/components/ui/text";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { useTheme } from "@/theme";
import { formatCompactCount } from "@/utils/formatCount.util";

export type PostActionTone = "reply" | "repost" | "like" | "bookmark" | "neutral";

const LIKE_PINK = { light: "#D3135F", dark: "#F7639E" } as const;

export function usePostActionTint(tone: PostActionTone): string {
  const { colors, isDark } = useTheme();
  if (tone === "like") return isDark ? LIKE_PINK.dark : LIKE_PINK.light;
  if (tone === "repost") return colors.successText;
  return colors.primary;
}

export interface PostActionButtonProps {
  readonly label: string;
  readonly tone: PostActionTone;
  readonly renderIcon: (ink: string) => ReactElement;
  readonly count?: number;
  readonly active?: boolean;
  readonly popOnActivate?: boolean;
  readonly popKey?: number;
  readonly onPress?: () => void;
  readonly defaultInk?: string;
  readonly containerStyle?: StyleProp<ViewStyle>;
}

export function PostActionButton({ label, tone, renderIcon, count, active = false, popOnActivate = false, popKey = 0, onPress, defaultInk, containerStyle }: PostActionButtonProps) {
  const { colors } = useTheme();
  const tint = usePostActionTint(tone);
  const isReducedMotionPreferred = useReducedMotionPreference();
  const popScale = useRef(new Animated.Value(1)).current;
  const visibleCount = count && count > 0 ? formatCompactCount(count) : null;

  const popIcon = () => {
    popScale.setValue(0.7);
    Animated.spring(popScale, { toValue: 1, friction: 3.5, tension: 240, useNativeDriver: true }).start();
  };

  useEffect(() => {
    if (popKey > 0 && !isReducedMotionPreferred) popIcon();
  }, [popKey]);

  const handlePress = () => {
    if (popOnActivate && !active && !isReducedMotionPreferred) popIcon();
    onPress?.();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count !== undefined ? `${label}, ${count}` : label}
      accessibilityState={popOnActivate ? { selected: active } : undefined}
      disabled={!onPress}
      onPress={handlePress}
      style={[styles.button, containerStyle]}
    >
      {({ pressed }) => {
        const ink = active || pressed ? tint : defaultInk ?? colors.textMuted;
        return (
          <>
            <View style={[styles.halo, pressed ? { backgroundColor: `${tint}26` } : null]}>
              <Animated.View style={{ transform: [{ scale: popScale }] }}>{renderIcon(ink)}</Animated.View>
            </View>
            {visibleCount ? (
              <Text size={13} weight={500} lineHeight={16} color={ink} numberOfLines={1} style={styles.count}>
                {visibleCount}
              </Text>
            ) : null}
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, minWidth: 44, flexDirection: "row", alignItems: "center" },
  halo: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  count: { marginLeft: -3, minWidth: 18, flexShrink: 0, fontVariant: ["tabular-nums"] },
});
