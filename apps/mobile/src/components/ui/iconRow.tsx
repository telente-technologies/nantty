import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

export interface IconRowProps {
  readonly icon: ReactNode;
  readonly children: ReactNode;
  readonly justify?: ViewStyle["justifyContent"];
  readonly gap?: number;
}

export function IconRow({ icon, children, justify = "flex-start", gap = 4 }: IconRowProps) {
  return (
    <View style={[styles.row, { justifyContent: justify, gap }]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {icon}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center" } });
