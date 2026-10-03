import { StyleSheet, View } from "react-native";

import { Eye14Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

import { liveAccent, liveGlass } from "./liveSurface.constant";

export interface LiveBadgeProps {
  readonly viewers?: number;
  readonly darkCounter?: boolean;
}

export function LiveBadge({ viewers, darkCounter = true }: LiveBadgeProps) {
  const { isDark } = useTheme();
  const counterOnGlass = darkCounter || isDark;
  const counterInk = counterOnGlass ? "#FFFFFF" : "#0A0A14";
  return (
    <View style={styles.row} accessibilityLabel={viewers === undefined ? "Live" : `Live, ${viewers} watching`}>
      <View style={styles.live}>
        <Text size={11} weight={700} lineHeight={14} letterSpacing={0.4} color="#FFFFFF">
          LIVE
        </Text>
      </View>
      {viewers === undefined ? null : (
        <View style={[styles.counter, { backgroundColor: counterOnGlass ? liveGlass.backgroundStrong : "#F0F2FA" }]}>
          <Eye14Icon color={counterInk} />
          <Text size={11} weight={600} lineHeight={14} color={counterInk}>
            {viewers}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  live: { height: 20, paddingHorizontal: 6, borderRadius: 6, backgroundColor: liveAccent.red, justifyContent: "center" },
  counter: { height: 20, paddingHorizontal: 6, borderRadius: 6, flexDirection: "row", alignItems: "center", gap: 3 },
});
