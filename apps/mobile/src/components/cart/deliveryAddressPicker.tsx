import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { SelectableRow } from "@/components/cart/selectableRow";
import { CaretRight24Icon } from "@/components/icons";
import { profileQueryKeys } from "@/components/profile/profileQueries.hook";
import { formatAddressLocation } from "@/components/settings/addressRow";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { usersService } from "@/services/account/users.service";
import { useDeliveryAddressStore } from "@/store/deliveryAddress.store";

export function DeliveryAddressPicker({ onAddAddress }: { onAddAddress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const { chosenAddressId, chooseDeliveryAddress } = useDeliveryAddressStore();
  const { data: addresses = [] } = useQuery({ queryKey: profileQueryKeys.addresses, queryFn: usersService.listMyShippingAddresses });
  const chosen = addresses.find((address) => address.id === chosenAddressId);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={chosen ? `Delivery address, ${formatAddressLocation(chosen)}` : "Choose delivery address"}
        onPress={() => setOpen(true)}
        style={styles.row}
      >
        <View style={styles.text}>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>Deliver to</Text>
          <Text size={14} weight={500} lineHeight={16.8} numberOfLines={2}>
            {chosen ? `${chosen.fullName}, ${formatAddressLocation(chosen)}` : "Choose delivery address"}
          </Text>
        </View>
        <CaretRight24Icon />
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Delivery address">
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {addresses.map((address) => (
            <SelectableRow
              key={address.id}
              selected={address.id === chosenAddressId}
              accessibilityLabel={`${address.fullName}, ${formatAddressLocation(address)}`}
              onPress={() => {
                chooseDeliveryAddress(address.id);
                setOpen(false);
              }}
            >
              <Text size={14} weight={500} lineHeight={16.8}>{address.fullName}</Text>
              <Text size={13} lineHeight={16.9} color={colors.textMuted}>{formatAddressLocation(address)}</Text>
            </SelectableRow>
          ))}
          <Button
            variant="subtle"
            title="Add new address"
            onPress={() => {
              setOpen(false);
              onAddAddress();
            }}
          />
        </ScrollView>
      </BottomSheet>
    </>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.divider },
  text: { flex: 1, gap: 4 },
  list: { maxHeight: 420 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
}));
