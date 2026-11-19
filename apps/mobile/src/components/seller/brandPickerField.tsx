import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CaretDown24Icon, MagnifyingGlass20Icon } from "@/components/icons";
import { BrandRow } from "@/components/store/brandRow";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { KEYBOARD_DISMISS_ON_DRAG } from "@/components/ui/dismissKeyboardOnEmptyTap.util";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { brandsService } from "@/services/sellers/brands.service";
import type { BrandSummary } from "@/types/brand.type";

export function BrandPickerField({ selectedBrandName, onSelectBrand }: { selectedBrandName: string | null; onSelectBrand: (brand: BrandSummary | null) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const brands = useQuery({ queryKey: ["brands", "search", search.trim()], queryFn: () => brandsService.searchBrands(search.trim()), enabled: open });
  const choose = (brand: BrandSummary | null) => {
    onSelectBrand(brand);
    setOpen(false);
  };
  return (
    <View style={styles.field}>
      <Text size={14} lineHeight={16.8}>Brand (optional)</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Brand: ${selectedBrandName ?? "none"}`} onPress={() => setOpen(true)} style={styles.box}>
        <Text size={14} lineHeight={16.8} color={selectedBrandName ? colors.text : colors.textSubtle}>{selectedBrandName ?? "Unbranded / my own design"}</Text>
        <CaretDown24Icon />
      </Pressable>
      <Text size={12} lineHeight={16.8} color={colors.textSubtle}>Only tag a brand if the product is genuine. Fake brand listings are removed.</Text>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Choose brand">
        <View style={styles.sheet}>
          <TextField placeholder="Search brands" value={search} onChangeText={setSearch} left={<MagnifyingGlass20Icon />} accessibilityLabel="Search brands" />
          <ScrollView style={styles.list} keyboardDismissMode={KEYBOARD_DISMISS_ON_DRAG} keyboardShouldPersistTaps="handled">
            <Pressable accessibilityRole="button" onPress={() => choose(null)} style={styles.none}>
              <Text size={14} lineHeight={16.8}>Unbranded / my own design</Text>
            </Pressable>
            {(brands.data ?? []).map((brand) => <BrandRow key={brand.id} brand={brand} onPress={() => choose(brand)} />)}
          </ScrollView>
        </View>
      </BottomSheet>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  field: { gap: 8 },
  box: { height: 42, borderWidth: 1, borderColor: colors.textSubtle, borderRadius: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface },
  sheet: { flexShrink: 1, paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  list: { flexShrink: 1, maxHeight: 380 },
  none: { minHeight: 48, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: colors.background },
}));
