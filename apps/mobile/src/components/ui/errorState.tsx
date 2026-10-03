import { StyleSheet, View } from "react-native";

import { colors } from "@/constants/colors.constant";

import { Button } from "./button";
import { Text } from "./text";

export interface ErrorStateProps {
  readonly message?: string;
  readonly onRetry?: () => void;
}

export function ErrorState({ message = "Something went wrong.", onRetry }: ErrorStateProps) {
  return (
    <View accessibilityRole="alert" style={styles.root}>
      <Text align="center" color={colors.textMuted}>{message}</Text>
      {onRetry ? <Button title="Retry" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 } });
