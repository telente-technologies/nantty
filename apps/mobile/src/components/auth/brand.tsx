import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export function BrandWordmark() {
  const { colors } = useTheme();
  return (
    <Text size={21} weight={700} lineHeight={25.2} letterSpacing={-0.42} color={colors.primaryDark} accessibilityRole="header">
      zudomart
    </Text>
  );
}
