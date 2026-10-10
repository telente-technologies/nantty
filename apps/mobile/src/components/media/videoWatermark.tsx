import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

export function VideoWatermark({ handle, top = 8 }: { readonly handle: string; readonly top?: number }) {
  if (!handle) return null;
  return (
    <View pointerEvents="none" style={[styles.mark, { top }]}>
      <Text size={11} weight={600} lineHeight={14} color="#FFFFFF" numberOfLines={1} style={styles.text}>
        @{handle} · Zudomart
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    position: "absolute",
    right: 10,
    maxWidth: "55%",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  text: { textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
});
