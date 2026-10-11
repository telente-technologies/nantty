import { View } from "react-native";

import { SelectableRow } from "@/components/cart/selectableRow";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { CartSellerGroup, PaymentMode } from "@/types";
import { canPayDirectly, describeStoreTrust } from "@/utils/paymentMode.util";

export interface PaymentModeChooserProps {
  readonly group: CartSellerGroup;
  readonly mode: PaymentMode;
  readonly onChange: (mode: PaymentMode) => void;
}

export function PaymentModeChooser({ group, mode, onChange }: PaymentModeChooserProps) {
  const { colors } = useTheme();
  const direct = canPayDirectly(group);
  return (
    <View style={{ gap: 8 }}>
      <Text size={13} weight={600} lineHeight={16.9}>
        {group.storeName}
        {direct ? " · Gold" : ""} · {describeStoreTrust(group)}
      </Text>
      {direct ? (
        <>
          <SelectableRow selected={mode === "escrow"} onPress={() => onChange("escrow")} accessibilityLabel={`Escrow protection for ${group.storeName}`}>
            <Text size={14} weight={500} lineHeight={16.8}>Escrow protection (recommended)</Text>
            <Text size={13} lineHeight={16.9} color={colors.textMuted}>Money is held until you confirm delivery.</Text>
          </SelectableRow>
          <SelectableRow selected={mode === "direct"} onPress={() => onChange("direct")} accessibilityLabel={`Pay ${group.storeName} directly`}>
            <Text size={14} weight={500} lineHeight={16.8}>Pay directly</Text>
            <Text size={13} lineHeight={16.9} color={colors.textMuted}>The seller is paid right away.</Text>
          </SelectableRow>
        </>
      ) : (
        <Text size={13} lineHeight={16.9} color={colors.textMuted}>Escrow: locked in your own wallet until delivery</Text>
      )}
    </View>
  );
}
