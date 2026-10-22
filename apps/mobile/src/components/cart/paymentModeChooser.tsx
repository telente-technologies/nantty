import { useState } from "react";
import { TextInput, View } from "react-native";

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

function DirectPaymentOption({ storeName, selected, onConfirm }: { readonly storeName: string; readonly selected: boolean; readonly onConfirm: () => void }) {
  const { colors } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  function changeConfirmation(value: string) {
    setConfirmation(value);
    if (value.trim().toUpperCase() === "DIRECT") {
      onConfirm();
      setConfirming(false);
      setConfirmation("");
    }
  }

  return (
    <>
      <SelectableRow selected={selected} onPress={() => { if (!selected) setConfirming(true); }} accessibilityLabel={`Pay ${storeName} directly`}>
        <Text size={14} weight={500} lineHeight={16.8}>Pay directly</Text>
        <Text size={13} lineHeight={16.9} color={colors.textMuted}>The seller is paid right away.</Text>
        {selected ? (
          <Text size={12} lineHeight={15.6} color={colors.cautionStrongText}>
            You lose escrow protection. Refunds and disputes depend on the seller, and Zudomart cannot hold or reverse this payment.
          </Text>
        ) : null}
      </SelectableRow>
      {!selected && confirming ? (
        <View style={{ gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.cautionTint }}>
          <Text size={12} lineHeight={15.6} color={colors.cautionStrongText}>
            You lose escrow protection. Refunds and disputes depend on the seller, and Zudomart cannot hold or reverse this payment.
          </Text>
          <Text size={12} lineHeight={15.6} color={colors.cautionStrongText}>
            Type DIRECT to confirm paying {storeName} directly.
          </Text>
          <TextInput
            value={confirmation}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel={`Type DIRECT to confirm paying ${storeName} directly`}
            placeholder="DIRECT"
            placeholderTextColor={colors.textSubtle}
            onChangeText={changeConfirmation}
            style={{ borderWidth: 1, borderColor: colors.divider, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, backgroundColor: colors.surface }}
          />
        </View>
      ) : null}
    </>
  );
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
          <DirectPaymentOption storeName={group.storeName} selected={mode === "direct"} onConfirm={() => onChange("direct")} />
        </>
      ) : (
        <Text size={13} lineHeight={16.9} color={colors.textMuted}>Escrow: locked in your own wallet until delivery</Text>
      )}
    </View>
  );
}
