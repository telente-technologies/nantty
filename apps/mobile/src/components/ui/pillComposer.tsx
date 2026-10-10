import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

import { PaperPlaneTilt24Icon } from "@/components/icons";
import { ComposerSlot } from "@/components/ui/composerSlot";
import { fontFamily } from "@/constants/typography.constant";
import { makeThemedStyles, useTheme } from "@/theme";
import { hasSendableContent } from "@/utils/sendableContent.util";

export interface PillComposerProps {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly onSend: (text: string) => void;
  readonly isSending: boolean;
  readonly placeholder: string;
  readonly inputLabel: string;
  readonly sendLabel: string;
  readonly maxLength?: number;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
}

export function PillComposer({ value, onChangeText, onSend, isSending, placeholder, inputLabel, sendLabel, maxLength, onFocus, onBlur }: PillComposerProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const hasContent = hasSendableContent(value);
  const sendTypedText = () => {
    if (!hasContent || isSending) return;
    onSend(value.trim());
  };
  return (
    <View style={styles.bar}>
      <View style={styles.field}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          multiline
          maxLength={maxLength}
          accessibilityLabel={inputLabel}
          style={styles.input}
        />
        {hasContent ? (
          <ComposerSlot slotKey="send">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={sendLabel}
              accessibilityState={{ disabled: isSending, busy: isSending }}
              disabled={isSending}
              hitSlop={6}
              onPress={sendTypedText}
              style={[styles.send, isSending && styles.sendBusy]}
            >
              {isSending ? <ActivityIndicator size="small" color={colors.white} /> : <PaperPlaneTilt24Icon size={18} color={colors.white} />}
            </Pressable>
          </ComposerSlot>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  bar: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  field: { flexDirection: "row", alignItems: "flex-end", minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.divider, paddingLeft: 14, paddingRight: 4, paddingVertical: 4, gap: 8 },
  input: { flex: 1, minHeight: 34, maxHeight: 120, paddingHorizontal: 0, paddingTop: 8, paddingBottom: 8, fontFamily: fontFamily[400], fontSize: 14, color: colors.text },
  send: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySolid, alignItems: "center", justifyContent: "center" },
  sendBusy: { opacity: 0.6 },
}));
