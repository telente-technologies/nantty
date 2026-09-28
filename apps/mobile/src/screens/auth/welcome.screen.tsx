import { StyleSheet, View } from "react-native";

import { BrandWordmark } from "@/components/auth/brand";
import { colors } from "@/constants/colors.constant";

export function WelcomeScreen() {
  return (
    <View style={styles.root}>
      <BrandWordmark />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" } });
