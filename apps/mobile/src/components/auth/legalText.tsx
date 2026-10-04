
import { openTrustedWebPage } from "@/components/links/openLink.util";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

const link = (label: string, url: string, linkColor: string) => (
  <Text size={12} lineHeight={16.8} color={linkColor} onPress={() => openTrustedWebPage(url)} accessibilityRole="link">
    {label}
  </Text>
);

export function LegalText() {
  const { colors } = useTheme();
  return (
    <Text size={12} lineHeight={16.8} color={colors.textSubtle} align="center">
      By continuing, you agree to our {link("Terms of Service", "https://zudomart.com/terms", colors.primary)} and acknowledge you have read our{" "}
      {link("Privacy Policy", "https://zudomart.com/privacy", colors.primary)} and {link("Cookie Use", "https://zudomart.com/cookies", colors.primary)} to learn how we
      collect, use, and share your data.
    </Text>
  );
}
