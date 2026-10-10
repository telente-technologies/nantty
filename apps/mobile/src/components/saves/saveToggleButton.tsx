import { useRef } from "react";
import { Animated, Pressable, type StyleProp, type ViewStyle } from "react-native";

import { BookmarkActionIcon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { useSaveToggle } from "@/hooks/useSaveToggle.hook";
import { useTheme } from "@/theme";
import type { SaveTarget } from "@/types";
import { formatCompactCount } from "@/utils/formatCount.util";
import { clipRailStyles } from "@/components/clips/clipRail.constant";

const SAVED_ITEM_NOUN: Record<SaveTarget["type"], string> = { post: "post", video: "video", clip: "clip", product: "product", comment: "reply" };

export interface SaveToggleButtonProps {
  readonly target: SaveTarget;
  readonly savedAccordingToServer: boolean;
  readonly foregroundColor?: string;
  readonly saveCount?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export function SaveToggleButton({ target, savedAccordingToServer, foregroundColor, saveCount, style }: SaveToggleButtonProps) {
  const { colors } = useTheme();
  const { isSaved, savedDelta, toggleSaved } = useSaveToggle(target, savedAccordingToServer);
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
      hitSlop={saveCount !== undefined ? { top: 11, bottom: 11 } : { top: 11, bottom: 11, left: 8, right: 8 }}
      onPress={toggleWithFeedback}
      style={[saveCount !== undefined ? clipRailStyles.item : null, style]}
    >
      <Animated.View style={{ transform: [{ scale: popScale }] }}>
        <BookmarkActionIcon size={saveCount !== undefined ? 26 : 22} color={isSaved ? savedInk : foregroundColor} filled={isSaved} />
      </Animated.View>
      {saveCount !== undefined ? (
        <Text size={13} lineHeight={16.9} color={foregroundColor} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[clipRailStyles.count, foregroundColor ? clipRailStyles.readableOnVideo : null]}>
          {formatCompactCount(Math.max(saveCount + savedDelta, 0))}
        </Text>
      ) : null}
    </Pressable>
  );
}
