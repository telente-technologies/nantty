import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { BrandWordmark } from "@/components/auth/brand";
import { colors } from "@/constants/colors.constant";
import type { AuthScreenProps } from "@/navigation/navigation.types";

export function SplashScreen({ navigation }: AuthScreenProps<"Splash">) {
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

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" } });
