import { useMemo, useState, type ReactNode } from "react";

import { BottomSheet } from "@/components/ui/bottomSheet";
import { createCountryRequiredRetry, type CountryRequiredRetry } from "@/utils/countryRequired.util";

import { CountryRequiredPicker, countryRequiredNote, countryRequiredTitle } from "./countryRequiredPicker";

export function CountryRequiredSheet({ visible, onClose, onSaved }: { readonly visible: boolean; readonly onClose: () => void; readonly onSaved: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={countryRequiredTitle} subtitle={countryRequiredNote} floating scrollable>
      <CountryRequiredPicker showHeading={false} onSaved={onSaved} />
    </BottomSheet>
  );
}

export function useCountryRequiredRetry(): { readonly retry: CountryRequiredRetry; readonly sheet: ReactNode } {
  const [visible, setVisible] = useState(false);
  const retry = useMemo(() => createCountryRequiredRetry(setVisible), []);
  return { retry, sheet: <CountryRequiredSheet visible={visible} onClose={retry.dismissed} onSaved={retry.saved} /> };
}
