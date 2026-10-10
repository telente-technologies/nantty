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
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { usersService } from "@/services/account/users.service";
import { ErrorState } from "@/components/ui/errorState";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Skeleton } from "@/components/ui/skeleton";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export function ShippingAddressesScreen({ navigation }: MainScreenProps<"ShippingAddresses">) {
  const { colors } = useTheme();
  const { data: addresses = [], isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: profileQueryKeys.addresses,
    queryFn: usersService.listMyShippingAddresses,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const refreshControl = usePullToRefresh(refetch);

  return (
    <SettingsPage title="Shipping Address" refreshControl={refreshControl}>
      {addresses.length > 0 ? (
        <SettingsGroup>
          {addresses.map((address) => (
            <AddressRow key={address.id} address={address} onPress={() => navigation.navigate("AddressForm", { addressId: address.id })} />
          ))}
        </SettingsGroup>
      ) : isLoading ? (
        <View style={styles.skeleton}>
          <Skeleton height={56} radius={12} />
          <Skeleton height={56} radius={12} />
        </View>
      ) : isError ? (
        <ErrorState compact message="Couldn't load your addresses." onRetry={() => refetch()} retrying={isRefetching} />
      ) : (
        <View style={styles.empty}>
          <Text size={typeScale.base} weight={500} lineHeight={19.2} align="center">
            No saved addresses
          </Text>
          <Text size={typeScale.sm} lineHeight={16.9} color={colors.textSubtle} align="center">
            Add where you'd like your orders delivered.
          </Text>
        </View>
      )}
      <Button title="Add new address" onPress={() => navigation.navigate("AddressForm")} />
    </SettingsPage>
  );
}

const styles = StyleSheet.create({ empty: { gap: spacing[2], paddingVertical: spacing[8] }, skeleton: { gap: spacing[2] } });
