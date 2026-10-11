import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useTheme } from "@/theme";

import { dismissKeyboardOnEmptyTap } from "./dismissKeyboardOnEmptyTap.util";

export interface ScreenProps {
  readonly children: ReactNode;
  readonly background?: string;
  readonly edges?: readonly Edge[];
  readonly dark?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

export function Screen({ children, background, edges = ["top"], dark = false, style }: ScreenProps) {
  const { colors, isDark } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: background ?? colors.background }]}>
      <StatusBar style={dark || isDark ? "light" : "dark"} />
      <View style={[styles.root, style]} onStartShouldSetResponder={dismissKeyboardOnEmptyTap}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
