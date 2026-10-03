import { StyleSheet, View } from "react-native";

import { makeThemedStyles } from "@/theme";

export function CustomizingFeedIllustration() {
  const styles = useStyles();
  return (
    <View style={styles.stage} accessibilityRole="image" accessibilityLabel="Customizing your feed">
      <View style={[styles.sideCard, styles.leftCard]} />
      <View style={[styles.sideCard, styles.rightCard]} />
      <View style={styles.frontCard} />
    </View>
  );
}

const STAGE_TOP_IN_FRAME = 278;

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  stage: { width: 393, height: 251, alignSelf: "center" },
  sideCard: { position: "absolute", width: 137.2, height: 158.4, borderRadius: 12, backgroundColor: colors.avatar },
  leftCard: { left: 117.75 - 68.6, top: 409.25 - STAGE_TOP_IN_FRAME - 79.2, transform: [{ rotate: "-15deg" }] },
  rightCard: { left: 271.45 - 68.6, top: 408.45 - STAGE_TOP_IN_FRAME - 79.2, transform: [{ rotate: "15deg" }] },
  frontCard: { position: "absolute", left: 93, top: 0, width: 207, height: 251, borderRadius: 12, backgroundColor: colors.placeholder },
}));
