import { StyleSheet, View } from "react-native";

import { CreditCard24Icon, SealCheck20Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { VerificationPlan } from "@/types/verification.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export interface MockIapSheetProps {
  readonly visible: boolean;
  readonly plan: VerificationPlan | null;
  readonly purchasing: boolean;
  readonly errorMessage?: string | null;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

export function MockIapSheet({ visible, plan, purchasing, errorMessage, onConfirm, onClose }: MockIapSheetProps) {
  const { colors } = useTheme();
  if (!plan) return null;
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Confirm subscription">
      <View style={styles.body}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          <CreditCard24Icon size={22} color={colors.textMuted} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <SealCheck20Icon size={20} color={colors.primary} />
          <Text size={15} weight={600} lineHeight={18}>Nantty Blue ({plan.tier === "PREMIUM" ? "Premium" : "Verified"})</Text>
        </View>
        <Text size={14} lineHeight={16.8}>{formatMoneyForDisplay(plan.price)} / {plan.interval}</Text>
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
          Payment is charged to your App Store or Google Play account and renews automatically until cancelled in your store account settings.
        </Text>
        {errorMessage ? <Text size={12} color={colors.error}>{errorMessage}</Text> : null}
        <Button title="Subscribe" loading={purchasing} onPress={onConfirm} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { paddingHorizontal: 16, paddingBottom: 20, gap: 10 } });
