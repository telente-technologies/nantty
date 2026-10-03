import { StyleSheet, View } from "react-native";

import { BrandWordmark } from "@/components/auth/brand";
import { makeThemedStyles } from "@/theme";

export function WelcomeScreen() {
  const styles = useStyles();
  return (
    <View style={styles.root}>
      <BrandWordmark />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" } }));
