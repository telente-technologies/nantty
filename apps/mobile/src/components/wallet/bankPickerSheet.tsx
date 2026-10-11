import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CaretDown24Icon, Check16Icon, MagnifyingGlass20Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { banksService } from "@/services/commerce/banks.service";
import { useLocaleStore } from "@/store/locale.store";
import type { Bank } from "@/types/commerce.type";

export interface BankPickerFieldProps {
  readonly selectedBankCode: string;
  readonly selectedBankName: string;
  readonly onSelectBank: (bank: Bank) => void;
}

export function BankPickerField({ selectedBankCode, selectedBankName, onSelectBank }: BankPickerFieldProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const countryCode = useLocaleStore((state) => state.countryCode ?? state.deviceRegionCode ?? "NG");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const banks = useQuery({ queryKey: ["banks", countryCode], queryFn: () => banksService.listBanksInCountry(countryCode) });
  const visibleBanks = useMemo(
    () => (banks.data ?? []).filter((bank) => bank.name.toLowerCase().includes(search.trim().toLowerCase())),
    [banks.data, search],
  );

  return (
    <View style={styles.field}>
      <Text size={14} lineHeight={16.8}>Bank</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Bank: ${selectedBankName || "choose your bank"}`} onPress={() => setOpen(true)} style={styles.box}>
        <Text size={14} lineHeight={16.8} color={selectedBankCode ? colors.text : colors.textSubtle}>
          {selectedBankName || "Choose your bank"}
        </Text>
        <CaretDown24Icon />
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Choose your bank">
        <View style={styles.sheetBody}>
          <TextField placeholder="Search banks" value={search} onChangeText={setSearch} left={<MagnifyingGlass20Icon />} accessibilityLabel="Search banks" />
          {banks.isLoading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
          {banks.isError ? <Text size={13} color={colors.error}>Couldn't load banks. Close and try again.</Text> : null}
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {visibleBanks.map((bank) => (
              <Pressable
                key={bank.code}
                accessibilityRole="radio"
                accessibilityState={{ checked: bank.code === selectedBankCode }}
                onPress={() => {
                  onSelectBank(bank);
                  setOpen(false);
                }}
                style={styles.option}
              >
                <Text size={14} lineHeight={16.8}>{bank.name}</Text>
                {bank.code === selectedBankCode ? <Check16Icon color={colors.primary} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </BottomSheet>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  field: { gap: 8 },
  box: { height: 42, borderWidth: 1, borderColor: colors.textSubtle, borderRadius: 8, paddingHorizontal: 12, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetBody: { flexShrink: 1, paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  loading: { marginVertical: 16 },
  list: { flexShrink: 1, maxHeight: 380 },
  option: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.background },
}));
