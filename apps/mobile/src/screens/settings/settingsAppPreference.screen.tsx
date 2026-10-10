import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Linking } from "react-native";

import { splitMoneyIntoSymbolAndAmount } from "@/components/seller/splitMoney.util";
import { CountryPickerSheet } from "@/components/settings/countryPickerSheet";
import { describeThemePreference, ThemePreferenceSheet } from "@/components/settings/themePreferenceSheet";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { GlobeHemisphereWest24Icon, Palette24Icon, PersonArmsSpread24Icon, Translate24Icon } from "@/components/icons";
import { localeService } from "@/services/geo/locale.service";
import { usersService } from "@/services/account/users.service";
import { useLocaleStore } from "@/store/locale.store";
import { useThemePreferenceStore, type ThemePreference } from "@/store/themePreference.store";
import { useTheme } from "@/theme";

export function SettingsAppPreferenceScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [themeSheetVisible, setThemeSheetVisible] = useState(false);
  const themePreference = useThemePreferenceStore((s) => s.preference);
  const setThemePreference = useThemePreferenceStore((s) => s.setPreference);
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

  const chooseThemePreference = (preference: ThemePreference) => {
    setThemePreference(preference);
    setThemeSheetVisible(false);
    usersService.updateMyThemePreference(preference).catch(() => undefined);
  };

  const currencySymbol = splitMoneyIntoSymbolAndAmount({ amountMinor: 0, currency }).symbol || currency;
  const currencyLabel = currentCountry ? `${currentCountry.currencyName} (${currencySymbol})` : currencySymbol;

  return (
    <SettingsPage title="App Preference">
      <SettingsGroup>
        <SettingsRow label="Theme" icon={<Palette24Icon />} trailing={{ text: describeThemePreference(themePreference) }} onPress={() => setThemeSheetVisible(true)} />
        <SettingsRow label="Language" icon={<Translate24Icon />} trailing={{ text: "English", color: colors.textMuted, weight: 400 }} />
        <SettingsRow label="Country & Currency" icon={<GlobeHemisphereWest24Icon />} trailing={{ text: currencyLabel }} onPress={() => setPickerVisible(true)} />
        <SettingsRow label="Accessibility" icon={<PersonArmsSpread24Icon />} onPress={() => Linking.openSettings()} />
      </SettingsGroup>
      <ThemePreferenceSheet
        visible={themeSheetVisible}
        selectedPreference={themePreference}
        onSelect={chooseThemePreference}
        onClose={() => setThemeSheetVisible(false)}
      />
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
