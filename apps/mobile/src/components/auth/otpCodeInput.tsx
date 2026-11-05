import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { removeNonDigitCharacters } from "@/utils/validators.util";

export const OTP_CODE_LENGTH = 6;

export interface OtpCodeInputProps {
  readonly value: string;
  readonly onChangeValue: (code: string) => void;
  readonly onCodeComplete?: (code: string) => void;
  readonly invalid?: boolean;
}

export function OtpCodeInput({ value, onChangeValue, onCodeComplete, invalid = false }: OtpCodeInputProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const hiddenInputRef = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);

  const updateCodeFromTypedText = (text: string) => {
    const code = removeNonDigitCharacters(text).slice(0, OTP_CODE_LENGTH);
    onChangeValue(code);
    if (code.length === OTP_CODE_LENGTH) onCodeComplete?.(code);
  };

  return (
    <Pressable
      accessibilityRole="none"
      accessibilityLabel={`Verification code, ${value.length} of ${OTP_CODE_LENGTH} digits entered`}
      onPress={() => hiddenInputRef.current?.focus()}
      style={styles.row}
    >
      {Array.from({ length: OTP_CODE_LENGTH }, (_, index) => {
        const isCurrentBox = focused && index === Math.min(value.length, OTP_CODE_LENGTH - 1);
        const borderColor = invalid ? colors.error : isCurrentBox ? colors.primary : colors.textSubtle;
        return (
          <View key={index} style={[styles.box, { borderColor }]}>
            <Text size={16} weight={500} lineHeight={19.2}>
              {value[index] ?? ""}
            </Text>
            {isCurrentBox && !value[index] ? <View style={styles.caret} /> : null}
          </View>
        );
      })}
      <TextInput
        ref={hiddenInputRef}
        value={value}
        onChangeText={updateCodeFromTypedText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={OTP_CODE_LENGTH}
        autoFocus
        caretHidden
        style={styles.hiddenInput}
        accessibilityLabel="Verification code"
      />
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  box: { flex: 1, height: 42, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  caret: { width: 2, height: 20, backgroundColor: colors.primarySolid },
  hiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0 },
}));
