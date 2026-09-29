import { useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

import { profileQueryKeys } from "@/components/profile/profileQueries.hook";
import { AddressRow } from "@/components/settings/addressRow";
import { SettingsGroup } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { usersService } from "@/services/users.service";

export function ShippingAddressesScreen({ navigation }: MainScreenProps<"ShippingAddresses">) {
  const { data: addresses = [], isLoading, refetch } = useQuery({
    queryKey: profileQueryKeys.addresses,
    queryFn: usersService.listMyShippingAddresses,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return (
    <SettingsPage title="Shipping Address">
      {addresses.length > 0 ? (
        <SettingsGroup>
          {addresses.map((address) => (
            <AddressRow key={address.id} address={address} onPress={() => navigation.navigate("AddressForm", { addressId: address.id })} />
          ))}
        </SettingsGroup>
      ) : isLoading ? null : (
        <View style={styles.empty}>
          <Text size={16} weight={500} lineHeight={19.2} align="center">
            No saved addresses
          </Text>
          <Text size={13} lineHeight={16.9} color={colors.textSubtle} align="center">
            Add where you'd like your orders delivered.
          </Text>
        </View>
      )}
      <Button title="Add new address" onPress={() => navigation.navigate("AddressForm")} />
    </SettingsPage>
  );
}

const styles = StyleSheet.create({ empty: { gap: 8, paddingVertical: 40 } });
