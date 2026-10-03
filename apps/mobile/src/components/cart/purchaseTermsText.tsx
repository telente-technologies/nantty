import { Linking } from "react-native";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export function PurchaseTermsText() {
  const { colors } = useTheme();
  return (
    <Text size={12} lineHeight={16.8} color={colors.textSubtle} align="center">
      By making a purchase, you agree to our{" "}
      <Text size={12} lineHeight={16.8} color={colors.primary} accessibilityRole="link" onPress={() => Linking.openURL("https://zudomart.com/terms")}>
        Terms of Service
      </Text>{" "}
      and{" "}
      <Text size={12} lineHeight={16.8} color={colors.primary} accessibilityRole="link" onPress={() => Linking.openURL("https://zudomart.com/privacy")}>
        Privacy Policy
      </Text>
      .
    </Text>
  );
}
