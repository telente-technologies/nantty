import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Package24Icon, Truck24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MarkOrderShippedInput } from "@/types/commerce.type";

const COMMON_COURIERS = ["GIG Logistics", "Kwik Delivery", "DHL Nigeria", "Sendbox", "Red Star Express", "Other"];

export interface MarkAsShippedSheetProps {
  readonly visible: boolean;
  readonly submitting: boolean;
  readonly errorMessage: string | null;
  readonly onClose: () => void;
  readonly onSubmit: (input: MarkOrderShippedInput) => void;
}

export function MarkAsShippedSheet({ visible, submitting, errorMessage, onClose, onSubmit }: MarkAsShippedSheetProps) {
  const { colors } = useTheme();
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null);
  const [otherCourierName, setOtherCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const courierName = selectedCourier === "Other" ? otherCourierName.trim() : selectedCourier ?? "";
  const readyToSubmit = courierName.length > 1 && trackingNumber.trim().length >= 4;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Mark as shipped" scrollable>
      <View style={styles.body}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          <Truck24Icon size={22} color={colors.textMuted} />
        </View>
        <Text size={13} lineHeight={17.5} color={colors.textMuted}>
          Add the courier and tracking number so the buyer can follow the parcel. The escrow release countdown starts when it's delivered.
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Package24Icon size={20} color={colors.textMuted} />
          <Text size={14} lineHeight={16.8}>Courier</Text>
        </View>
        <View style={styles.chips}>
          {COMMON_COURIERS.map((courier) => (
            <Chip key={courier} kind="topic" label={courier} selected={selectedCourier === courier} onPress={() => setSelectedCourier(courier)} />
          ))}
        </View>
        {selectedCourier === "Other" ? (
          <TextField label="Courier name" placeholder="e.g. ABC Transport" value={otherCourierName} onChangeText={setOtherCourierName} />
        ) : null}
        <TextField
          label="Tracking number"
          placeholder="e.g. GIG-7730941182"
          autoCapitalize="characters"
          autoCorrect={false}
          value={trackingNumber}
          onChangeText={setTrackingNumber}
        />
        {errorMessage ? (
          <Text size={12} lineHeight={16} color={colors.error} accessibilityRole="alert">{errorMessage}</Text>
        ) : null}
        <Button
          title="Confirm shipment"
          disabled={!readyToSubmit}
          loading={submitting}
          onPress={() => onSubmit({ courierName, trackingNumber: trackingNumber.trim() })}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 4, gap: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
