import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export function BrandWordmark() {
  return (
    <Text size={21} weight={700} lineHeight={25.2} letterSpacing={-0.42} color={colors.primaryDark} accessibilityRole="header">
      zudomart
    </Text>
  );
}
