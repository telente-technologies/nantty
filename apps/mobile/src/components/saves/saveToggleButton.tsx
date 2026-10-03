import { useRef } from "react";
import { Animated, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { Bookmark24Icon, BookmarkFill24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { useSaveToggle } from "@/hooks/useSaveToggle.hook";
import { useTheme } from "@/theme";
import type { SaveTarget } from "@/types";

const SAVED_ITEM_NOUN: Record<SaveTarget["type"], string> = { post: "post", video: "video", clip: "clip", product: "product" };

export interface SaveToggleButtonProps {
  readonly target: SaveTarget;
  readonly savedAccordingToServer: boolean;
  readonly foregroundColor?: string;
  readonly showLabel?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

export function SaveToggleButton({ target, savedAccordingToServer, foregroundColor, showLabel = false, style }: SaveToggleButtonProps) {
  const { colors } = useTheme();
  const { isSaved, toggleSaved } = useSaveToggle(target, savedAccordingToServer);
  const isReducedMotionPreferred = useReducedMotionPreference();
  const popScale = useRef(new Animated.Value(1)).current;
  const noun = SAVED_ITEM_NOUN[target.type];

  const toggleWithFeedback = () => {
    if (!isSaved && !isReducedMotionPreferred) {
      popScale.setValue(0.8);
      Animated.spring(popScale, { toValue: 1, friction: 4, tension: 220, useNativeDriver: true }).start();
    }
    void toggleSaved();
  };

  const savedInk = foregroundColor ?? colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isSaved ? `Remove ${noun} from saved` : `Save ${noun}`}
      accessibilityState={{ selected: isSaved }}
      hitSlop={8}
      onPress={toggleWithFeedback}
      style={[showLabel ? styles.withLabel : null, style]}
    >
      <Animated.View style={{ transform: [{ scale: popScale }] }}>
        {isSaved ? <BookmarkFill24Icon color={savedInk} /> : <Bookmark24Icon color={foregroundColor} />}
      </Animated.View>
      {showLabel ? (
        <Text size={13} lineHeight={16.9} color={foregroundColor} style={foregroundColor ? styles.readableOnVideo : undefined}>
          {isSaved ? "Saved" : "Save"}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  withLabel: { width: 32, gap: 4, alignItems: "center" },
  readableOnVideo: { textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
});
