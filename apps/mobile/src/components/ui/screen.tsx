import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { colors } from "@/constants/colors.constant";

export interface ScreenProps {
  readonly children: ReactNode;
  readonly background?: string;
  readonly edges?: readonly Edge[];
  readonly dark?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

export function Screen({ children, background = colors.background, edges = ["top"], dark = false, style }: ScreenProps) {
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: background }]}>
      <StatusBar style={dark ? "light" : "dark"} />
      <View style={[styles.root, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
