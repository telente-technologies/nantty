import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { SelectableRow } from "@/components/cart/selectableRow";
import { PhotoEvidencePicker } from "@/components/escrow/photoEvidencePicker";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { IdentityDocumentType } from "@/types/account.type";

import type { ApplicationStepProps } from "./applicationStoreAndContactSteps";
import { maskAllButLastFourCharacters } from "./maskSensitiveNumber.util";

export const IDENTITY_DOCUMENT_OPTIONS: readonly { readonly id: IdentityDocumentType; readonly label: string; readonly hint: string }[] = [
  { id: "nin_slip", label: "NIN slip or card", hint: "11-digit National Identification Number" },
  { id: "drivers_licence", label: "Driver's licence", hint: "Issued by the FRSC" },
  { id: "voters_card", label: "Voter's card (PVC)", hint: "Permanent Voter's Card" },
  { id: "international_passport", label: "International passport", hint: "Data page only" },
];

export function ApplicationIdentityStep({ draft, onChange, onUploadingChange }: ApplicationStepProps & { onUploadingChange: (uploading: boolean) => void }) {
  const [numberFieldFocused, setNumberFieldFocused] = useState(false);
  return (
    <View style={styles.fields}>
      <View style={styles.options} accessibilityRole="radiogroup">
        {IDENTITY_DOCUMENT_OPTIONS.map((option) => (
          <SelectableRow
            key={option.id}
            selected={draft.identityDocumentType === option.id}
            onPress={() => onChange({ identityDocumentType: option.id })}
            accessibilityLabel={option.label}
          >
            <Text size={14} lineHeight={16.8}>{option.label}</Text>
            <Text size={12} lineHeight={16.8} color={colors.textSubtle}>{option.hint}</Text>
          </SelectableRow>
        ))}
      </View>
      <TextField
        label="Document number"
        placeholder="Enter the number on your document"
        password
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        value={draft.identityDocumentNumber}
        onFocus={() => setNumberFieldFocused(true)}
        onBlur={() => setNumberFieldFocused(false)}
        onChangeText={(identityDocumentNumber) => onChange({ identityDocumentNumber: identityDocumentNumber.replace(/[^A-Za-z0-9]/g, "").slice(0, 20) })}
      />
      {draft.identityDocumentNumber && !numberFieldFocused ? (
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>Saved as {maskAllButLastFourCharacters(draft.identityDocumentNumber)}</Text>
      ) : null}
      <View style={styles.group}>
        <Text size={14} lineHeight={16.8}>Photo of your document</Text>
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>
          Take a clear photo in good light with all four corners visible. It's encrypted and only seen by our verification team.
        </Text>
        <PhotoEvidencePicker
          photoUrls={draft.identityDocumentPhotoUrl ? [draft.identityDocumentPhotoUrl] : []}
          onChangePhotoUrls={(urls) => onChange({ identityDocumentPhotoUrl: urls[0] ?? null })}
          maximumPhotos={1}
          addLabel="Add ID photo"
          onUploadingChange={onUploadingChange}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ fields: { gap: 16 }, options: { gap: 8 }, group: { gap: 8 } });
