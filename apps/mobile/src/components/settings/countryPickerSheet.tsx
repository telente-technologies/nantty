import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Check16Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { CountryOption } from "@/types/account.type";

export interface CountryPickerSheetProps {
  readonly visible: boolean;
  readonly countries: readonly CountryOption[];
  readonly selectedCountryCode: string | null;
  readonly onSelect: (country: CountryOption) => void;
  readonly onClose: () => void;
}

export function CountryPickerSheet({ visible, countries, selectedCountryCode, onSelect, onClose }: CountryPickerSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Country & currency">
      <ScrollView style={styles.list} contentContainerStyle={styles.content}>
        {countries.map((country) => {
          const selected = country.countryCode === selectedCountryCode;
          return (
            <Pressable
              key={country.countryCode}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onSelect(country)}
              style={styles.row}
            >
              <View style={styles.text}>
                <Text size={14} lineHeight={16.8}>
                  {country.countryName}
                </Text>
                <Text size={12} lineHeight={16.8} color={colors.textMuted}>
                  {country.currencyName} ({country.currency})
                </Text>
              </View>
              {selected ? <Check16Icon color={colors.primary} /> : null}
            </Pressable>
          );
        })}
        <Text size={12} lineHeight={16.8} color={colors.textSubtle} style={styles.note}>
          Prices are shown in your country's currency. If your country isn't listed, prices show in US dollars.
        </Text>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 420 },
  content: { paddingHorizontal: 16, paddingBottom: 16 },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.background },
  text: { gap: 2 },
  note: { marginTop: 12 },
});
