import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { BrandWordmark } from "@/components/auth/brand";
import { makeThemedStyles } from "@/theme";
import type { AuthScreenProps } from "@/navigation/navigation.types";

export function SplashScreen({ navigation }: AuthScreenProps<"Splash">) {
  const styles = useStyles();
  useEffect(() => {
    const timer = setTimeout(() => navigation.replace("Onboarding", { mode: "signup" }), 1200);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.root}>
      <BrandWordmark />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" } }));
