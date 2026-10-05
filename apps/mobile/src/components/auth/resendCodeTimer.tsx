import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export interface ResendCodeTimerProps {
  readonly secondsUntilResendAllowed: number;
  readonly restartKey: number;
  readonly onPressResendCode: () => void;
}

export function ResendCodeTimer({ secondsUntilResendAllowed, restartKey, onPressResendCode }: ResendCodeTimerProps) {
  const { colors } = useTheme();
  const [secondsRemaining, setSecondsRemaining] = useState(secondsUntilResendAllowed);

  useEffect(() => {
    setSecondsRemaining(secondsUntilResendAllowed);
    const interval = setInterval(() => setSecondsRemaining((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(interval);
  }, [secondsUntilResendAllowed, restartKey]);

  return (
    <View style={styles.root}>
      {secondsRemaining > 0 ? (
        <View style={styles.row}>
          <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
            Resend code
          </Text>
          <Text size={12} weight={500} lineHeight={16.8}>
            {secondsRemaining}s
          </Text>
        </View>
      ) : (
        <Text size={12} weight={500} lineHeight={16.8} color={colors.primary} accessibilityRole="link" onPress={onPressResendCode}>
          Resend code
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
});
