
import { inAppBrowserColorsFromTheme, openTrustedWebPage } from "@/components/links/openLink.util";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export function PurchaseTermsText() {
  const { colors } = useTheme();
  return (
    <Text size={12} lineHeight={16.8} color={colors.textSubtle} align="center">
      By making a purchase, you agree to our{" "}
      <Text size={12} lineHeight={16.8} color={colors.primary} accessibilityRole="link" onPress={() => openTrustedWebPage("https://zudomart.com/terms", inAppBrowserColorsFromTheme(colors))}>
        Terms of Service
      </Text>{" "}
      and{" "}
      <Text size={12} lineHeight={16.8} color={colors.primary} accessibilityRole="link" onPress={() => openTrustedWebPage("https://zudomart.com/privacy", inAppBrowserColorsFromTheme(colors))}>
        Privacy Policy
      </Text>
      .
    </Text>
  );
}
