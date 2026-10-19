import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { rootNavigationRef } from "@/navigation/navigationRef";
import { useTheme } from "@/theme";
import { BLUE_PREMIUM_PROFILES_UPSELL } from "@/utils/businessProfileAllowance.util";

export function openBluePremiumPlans(): void {
  if (!rootNavigationRef.isReady()) return;
  (rootNavigationRef.navigate as (route: string) => void)("Verification");
}

export function BluePremiumProfilesUpsell({ note, onBeforeOpen }: { readonly note?: string | null; readonly onBeforeOpen?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.box}>
      <Text size={14} weight={600} lineHeight={18}>{BLUE_PREMIUM_PROFILES_UPSELL}</Text>
      <Text size={12} lineHeight={16} color={colors.textMuted}>{note ?? "Run up to 5 business profiles from one account, with one store among them."}</Text>
      <Button
        variant="outline"
        title="See Blue Premium"
        height={40}
        onPress={() => {
          onBeforeOpen?.();
          openBluePremiumPlans();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 6, alignSelf: "stretch" },
});
