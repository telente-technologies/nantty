import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Phone24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export interface PhoneNumberSheetProps {
  readonly visible: boolean;
  readonly initialPhone: string | null;
  readonly saving: boolean;
  readonly onClose: () => void;
  readonly onSave: (phone: string) => void;
}

const isValidNigerianPhoneNumber = (value: string) => /^(\+?234|0)[789][01]\d{8}$/.test(value.replace(/\s+/g, ""));

export function PhoneNumberSheet({ visible, initialPhone, saving, onClose, onSave }: PhoneNumberSheetProps) {
  const { colors } = useTheme();
  const [phone, setPhone] = useState(initialPhone ?? "");
  const valid = isValidNigerianPhoneNumber(phone);
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Phone number" scrollable>
      <View style={styles.body}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          <Phone24Icon size={22} color={colors.textMuted} />
        </View>
        <TextField
          label="Phone number"
          placeholder="0907 750 5722"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          value={phone}
          onChangeText={setPhone}
        />
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
          We'll send a code to confirm this number before it's added to your account.
        </Text>
        <Button title="Save" disabled={!valid} loading={saving} onPress={() => onSave(phone.replace(/\s+/g, ""))} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { paddingBottom: 4, gap: 16 } });
