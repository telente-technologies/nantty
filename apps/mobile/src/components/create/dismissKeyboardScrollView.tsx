import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { dismissKeyboardIfVisible, KEYBOARD_DISMISS_ON_DRAG } from "@/components/ui/dismissKeyboardOnEmptyTap.util";

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
      keyboardDismissMode={KEYBOARD_DISMISS_ON_DRAG}
    >
      <Pressable accessible={false} onPress={dismissKeyboardIfVisible} style={[styles.grow, contentContainerStyle]}>
        {children}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, grow: { flexGrow: 1 } });
