import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { profileQueryKeys } from "@/components/profile/profileQueries.hook";
import { AddressGeoFields } from "@/components/settings/addressGeoFields";
import { useGeoCountries } from "@/components/settings/geoQueries.hook";
import { SettingsCenteredAction, SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { PushPin24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { usersService } from "@/services/account/users.service";
import type { ShippingAddressInput } from "@/types/account.type";

const EMPTY_ADDRESS: ShippingAddressInput = {
  fullName: "", phone: "", line1: "", postalCode: "", details: "", isDefault: false, countryId: "ng", stateId: null, lgaId: null, cityId: null,
};

export function AddressFormScreen({ navigation, route }: MainScreenProps<"AddressForm">) {
  const { colors } = useTheme();
  const addressId = route.params?.addressId;
  const queryClient = useQueryClient();
  const { data: addresses } = useQuery({ queryKey: profileQueryKeys.addresses, queryFn: usersService.listMyShippingAddresses });
  const [form, setForm] = useState<ShippingAddressInput>(EMPTY_ADDRESS);

  useEffect(() => {
    const existing = addresses?.find((a) => a.id === addressId);
    if (existing) {
      const { id: _id, ...input } = existing;
      setForm(input);
    }
  }, [addresses, addressId]);

  const finishAndGoBack = () => {
    queryClient.invalidateQueries({ queryKey: profileQueryKeys.addresses });
    navigation.goBack();
  };

  const saveAddress = useMutation({
    mutationFn: () => (addressId ? usersService.updateShippingAddress(addressId, form) : usersService.createShippingAddress(form)),
    onSuccess: finishAndGoBack,
  });
  const deleteAddress = useMutation({ mutationFn: () => usersService.deleteShippingAddress(addressId!), onSuccess: finishAndGoBack });

  const updateField = (field: "fullName" | "phone" | "line1" | "postalCode" | "details") => (value: string) => setForm((f) => ({ ...f, [field]: value }));
  const country = useGeoCountries().data?.find((candidate) => candidate.id === form.countryId);
  const missingGeoLevel = (["state", "lga", "city"] as const).some(
    (level) => country?.levels.includes(level) && !form[`${level}Id` as const],
  );
  const formIsComplete = !!country && !missingGeoLevel && [form.fullName, form.phone, form.line1].every((v) => v.trim().length > 0);

  return (
    <SettingsPage title={addressId ? "Edit address" : "New address"} gap={24}>
      <View style={styles.fields}>
        <TextField label="Recipient name" placeholder="Enter full name" value={form.fullName} onChangeText={updateField("fullName")} autoComplete="name" />
        <TextField label="Phone number" placeholder="0907 750 5722" value={form.phone} onChangeText={updateField("phone")} keyboardType="phone-pad" autoComplete="tel" />
        <AddressGeoFields value={form} onChange={(geo) => setForm((f) => ({ ...f, ...geo }))} />
        <TextField label="Street address" placeholder="House number and street" value={form.line1} onChangeText={updateField("line1")} autoComplete="street-address" />
        <TextField label="Postal code (optional)" placeholder="Postal code" value={form.postalCode} onChangeText={updateField("postalCode")} keyboardType="number-pad" autoComplete="postal-code" />
        <TextField label="Delivery details (optional)" placeholder="Landmark, gate code, floor" value={form.details} onChangeText={updateField("details")} multiline />
      </View>
      <SettingsGroup>
        <SettingsRow
          label="Use as default address"
          icon={<PushPin24Icon />}
          trailing={{ text: form.isDefault ? "Yes" : "No", color: form.isDefault ? colors.primary : colors.textSubtle }}
          onPress={() => setForm((f) => ({ ...f, isDefault: !f.isDefault }))}
        />
      </SettingsGroup>
      {saveAddress.isError ? (
        <Text size={12} lineHeight={14.4} color={colors.error}>
          {saveAddress.error.message}
        </Text>
      ) : null}
      <Button title="Save" disabled={!formIsComplete} loading={saveAddress.isPending} onPress={() => saveAddress.mutate()} />
      {addressId ? <SettingsCenteredAction label="Delete address" onPress={() => deleteAddress.mutate()} /> : null}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({ fields: { gap: 16 } });
