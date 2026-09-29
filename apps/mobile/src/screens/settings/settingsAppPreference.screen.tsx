import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Linking } from "react-native";

import { splitMoneyIntoSymbolAndAmount } from "@/components/seller/splitMoney.util";
import { CountryPickerSheet } from "@/components/settings/countryPickerSheet";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { localeService } from "@/services/locale.service";
import { usersService } from "@/services/users.service";
import { useLocaleStore } from "@/store/locale.store";

export function SettingsAppPreferenceScreen() {
  const queryClient = useQueryClient();
  const [pickerVisible, setPickerVisible] = useState(false);
  const countryCode = useLocaleStore((s) => s.countryCode);
  const currency = useLocaleStore((s) => s.currency);
  const { data: countries = [] } = useQuery({ queryKey: ["locale", "countries"], queryFn: usersService.listSupportedCountries });
  const currentCountry = countries.find((c) => c.countryCode === countryCode);

  const saveCountryAndReloadPrices = useMutation({
    mutationFn: async (newCountryCode: string) => {
      await usersService.updateMyCountryPreference(newCountryCode);
      await localeService.loadViewerLocaleIntoStore();
    },
    onSuccess: () => {
      setPickerVisible(false);
      queryClient.invalidateQueries();
    },
  });

  const currencySymbol = splitMoneyIntoSymbolAndAmount({ amountMinor: 0, currency }).symbol || currency;
  const currencyLabel = currentCountry ? `${currentCountry.currencyName} (${currencySymbol})` : currencySymbol;

  return (
    <SettingsPage title="App Preference">
      <SettingsGroup>
        <SettingsRow label="Theme" trailing={{ text: "Light Mode" }} />
        <SettingsRow label="Language" trailing={{ text: "English" }} />
        <SettingsRow label="Country & Currency" trailing={{ text: currencyLabel }} onPress={() => setPickerVisible(true)} />
        <SettingsRow label="Accessibility" onPress={() => Linking.openSettings()} />
      </SettingsGroup>
      <CountryPickerSheet
        visible={pickerVisible}
        countries={countries}
        selectedCountryCode={countryCode}
        onSelect={(country) => saveCountryAndReloadPrices.mutate(country.countryCode)}
        onClose={() => setPickerVisible(false)}
      />
    </SettingsPage>
  );
}
