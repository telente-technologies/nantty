import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export function EarnBackLine({ basisPoints }: { readonly basisPoints?: number | null }) {
  const { colors } = useTheme();
  if (!basisPoints) return null;
  const percent = basisPoints / 100;
  return <Text size={13} weight={500} lineHeight={16.9} color={colors.primary}>Earn {percent}% back at this store</Text>;
}
