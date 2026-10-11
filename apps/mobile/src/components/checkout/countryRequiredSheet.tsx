import { useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottomSheet";
import { spacing } from "@/constants/spacing.constant";
import { createCountryRequiredRetry, type CountryRequiredRetry } from "@/utils/countryRequired.util";

import { CountryRequiredPicker, countryRequiredNote, countryRequiredTitle } from "./countryRequiredPicker";

export function CountryRequiredSheet({ visible, onClose, onSaved }: { readonly visible: boolean; readonly onClose: () => void; readonly onSaved: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={countryRequiredTitle} subtitle={countryRequiredNote} floating>
      <View style={styles.body}>
        <CountryRequiredPicker showHeading={false} onSaved={onSaved} />
      </View>
    </BottomSheet>
  );
}

export function useCountryRequiredRetry(): { readonly retry: CountryRequiredRetry; readonly sheet: ReactNode } {
  const [visible, setVisible] = useState(false);
  const retry = useMemo(() => createCountryRequiredRetry(setVisible), []);
  return { retry, sheet: <CountryRequiredSheet visible={visible} onClose={retry.dismissed} onSaved={retry.saved} /> };
}

const styles = StyleSheet.create({ body: { paddingHorizontal: spacing[4], paddingBottom: spacing[5] } });
