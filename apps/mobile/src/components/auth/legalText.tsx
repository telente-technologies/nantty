import { Linking } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

const link = (label: string, url: string) => (
  <Text size={12} lineHeight={16.8} color={colors.primary} onPress={() => Linking.openURL(url)} accessibilityRole="link">
    {label}
  </Text>
);

export function LegalText() {
  return (
    <Text size={12} lineHeight={16.8} color={colors.textSubtle} align="center">
      By continuing, you agree to our {link("Terms of Service", "https://zudomart.com/terms")} and acknowledge you have read our{" "}
      {link("Privacy Policy", "https://zudomart.com/privacy")} and {link("Cookie Use", "https://zudomart.com/cookies")} to learn how we
      collect, use, and share your data.
    </Text>
  );
}
