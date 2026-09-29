import { Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export interface FollowPillProps {
  readonly isFollowing: boolean;
  readonly onPress: () => void;
  readonly outlined?: boolean;
  readonly large?: boolean;
}

export function FollowPill({ isFollowing, onPress, outlined = false, large = false }: FollowPillProps) {
  const filled = !outlined && !isFollowing;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isFollowing }}
      onPress={onPress}
      style={[
        styles.pill,
        large ? styles.large : styles.small,
        filled ? styles.filled : styles.outline,
        isFollowing && styles.following,
      ]}
    >
      <Text size={12} lineHeight={large ? 16.8 : 14.5} letterSpacing={large ? -0.24 : 0} color={filled ? colors.white : colors.text}>
        {isFollowing ? "Following" : "Follow"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 4, alignItems: "center", justifyContent: "center" },
  small: { height: 23, paddingHorizontal: 12 },
  large: { height: 25, paddingHorizontal: 16 },
  filled: { backgroundColor: colors.primary },
  outline: { borderWidth: 1, borderColor: colors.black },
  following: { borderColor: colors.divider, backgroundColor: colors.chip },
});
