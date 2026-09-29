import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

import { Text } from "@/components/ui/text";

export function LiveGiftBurst({ burst }: { burst: { readonly key: number; readonly emoji: string } | null }) {
  const burstProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!burst) return;
    burstProgress.setValue(0);
    Animated.timing(burstProgress, { toValue: 1, duration: 1_600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [burst, burstProgress]);

  if (!burst) return null;
  const translateY = burstProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -220] });
  const scale = burstProgress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1.4, 1] });
  const opacity = burstProgress.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.View pointerEvents="none" style={[styles.burst, { opacity, transform: [{ translateY }, { scale }] }]}>
      <Text size={56} lineHeight={64} accessibilityLabel="Gift sent">
        {burst.emoji}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  burst: { position: "absolute", bottom: 140, alignSelf: "center" },
});
