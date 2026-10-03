import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export function AiGeneratedLabel({ onVideo = false }: { onVideo?: boolean }) {
  return (
    <View accessible accessibilityLabel="AI generated" style={[styles.label, onVideo && styles.onVideo]}>
      <Text size={11} weight={500} lineHeight={14} color={onVideo ? colors.white : colors.textMuted}>
        AI generated
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: colors.divider },
  onVideo: { borderColor: "rgba(255,255,255,0.6)", backgroundColor: "rgba(0,0,0,0.35)" },
});
