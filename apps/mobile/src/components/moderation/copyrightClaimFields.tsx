import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { Check16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { makeThemedStyles, useTheme } from "@/theme";

export interface ClaimTextFieldProps extends Pick<TextInputProps, "keyboardType" | "autoCapitalize" | "autoComplete" | "placeholder"> {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly multiline?: boolean;
  readonly maximumLength?: number;
  readonly errorMessage?: string | null;
  readonly hint?: string;
}

export function ClaimTextField({ label, value, onChangeText, multiline, maximumLength = 1000, errorMessage, hint, ...inputProps }: ClaimTextFieldProps) {
  const { colors } = useTheme();
  const styles = useClaimFieldStyles();
  return (
    <View style={styles.field}>
      <Text size={13} weight={500} lineHeight={16.9}>
        {label}
      </Text>
      {hint ? (
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>
          {hint}
        </Text>
      ) : null}
      <TextInput
        {...inputProps}
        value={value}
        onChangeText={(text) => onChangeText(text.slice(0, maximumLength))}
        placeholderTextColor={colors.textSubtle}
        selectionColor={colors.primary}
        multiline={multiline}
        maxLength={maximumLength}
        accessibilityLabel={label}
        style={[styles.input, multiline ? styles.multilineInput : null, errorMessage ? styles.invalidInput : null]}
      />
      {errorMessage ? (
        <Text size={12} lineHeight={16.8} color={colors.error}>
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}

export function ClaimCheckbox({ checked, onToggle, label }: { readonly checked: boolean; readonly onToggle: () => void; readonly label: string }) {
  const { colors } = useTheme();
  const styles = useClaimFieldStyles();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onToggle} style={styles.declarationRow}>
      <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>{checked ? <Check16Icon color={colors.white} /> : null}</View>
      <Text size={13} lineHeight={18.2} style={styles.declarationText}>
        {label}
      </Text>
    </Pressable>
  );
}

export const useClaimFieldStyles = makeThemedStyles((colors) => StyleSheet.create({
  field: { gap: 6 },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    fontFamily: fontFamily[400],
    fontSize: 14,
    letterSpacing: calculateDefaultLetterSpacing(14),
    color: colors.text,
  },
  multilineInput: { minHeight: 80, textAlignVertical: "top" },
  invalidInput: { borderColor: colors.error },
  declarationRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: { width: 20, height: 20, marginTop: 1, borderRadius: 4, borderWidth: 1.5, borderColor: colors.textMuted, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: colors.primarySolid, borderColor: colors.primary },
  declarationText: { flex: 1 },
  segmentRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  segmentInput: { flex: 1 },
  sectionTitle: { marginTop: 8 },
  scopeRow: { flexDirection: "row", gap: 8 },
}));
