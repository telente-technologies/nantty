import { StyleSheet, View } from "react-native";

import { Eye14Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export interface LiveBadgeProps {
  readonly viewers?: number;
  readonly darkCounter?: boolean;
}

export function LiveBadge({ viewers, darkCounter = true }: LiveBadgeProps) {
  return (
    <View style={styles.row} accessibilityLabel={viewers === undefined ? "Live" : `Live, ${viewers} watching`}>
      <View style={styles.live}>
        <Text size={11} weight={500} lineHeight={15.4} letterSpacing={-0.22} color={colors.white}>
          LIVE
        </Text>
      </View>
      {viewers === undefined ? null : (
        <View style={[styles.counter, { backgroundColor: darkCounter ? colors.avatar : colors.chip }]}>
          <Eye14Icon color={darkCounter ? colors.white : colors.black} />
          <Text size={11} weight={500} lineHeight={15.4} letterSpacing={-0.22} color={darkCounter ? colors.white : colors.black}>
            {viewers}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 2 },
  live: { height: 19, paddingHorizontal: 4, borderRadius: 2, backgroundColor: colors.error, justifyContent: "center" },
  counter: { height: 19, paddingHorizontal: 4, borderRadius: 2, flexDirection: "row", alignItems: "center" },
});
