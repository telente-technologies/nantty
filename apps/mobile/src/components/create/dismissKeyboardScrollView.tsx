import type { ReactNode } from "react";
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

export interface DismissKeyboardScrollViewProps {
  readonly children: ReactNode;
  readonly contentContainerStyle?: StyleProp<ViewStyle>;
}

export function DismissKeyboardScrollView({ children, contentContainerStyle }: DismissKeyboardScrollViewProps) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.grow}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
    >
      <Pressable accessible={false} onPress={() => Keyboard.dismiss()} style={[styles.grow, contentContainerStyle]}>
        {children}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, grow: { flexGrow: 1 } });
