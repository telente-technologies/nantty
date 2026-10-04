import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { liveSafetyService } from "@/services/liveSafety.service";
import { makeThemedStyles, useTheme } from "@/theme";

const MAXIMUM_APPEAL_LENGTH = 1000;

export interface LiveSafetyAppealSheetProps {
  readonly liveId: string | null;
  readonly onClose: () => void;
  readonly onAppealed: () => void;
}

export function LiveSafetyAppealSheet({ liveId, onClose, onAppealed }: LiveSafetyAppealSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [message, setMessage] = useState("");
  const idempotencyKey = useRef(generateIdempotencyKey());
  const appeal = useMutation({
    mutationFn: () => liveSafetyService.appealLiveSafetyHold(liveId ?? "", message.trim(), idempotencyKey.current),
    onSuccess: onAppealed,
  });

  useEffect(() => {
    if (!liveId) return;
    setMessage("");
    idempotencyKey.current = generateIdempotencyKey();
    appeal.reset();
  }, [liveId]);

  return (
    <BottomSheet visible={!!liveId} onClose={onClose} title={appeal.isSuccess ? "Appeal sent" : "Appeal this pause"}>
      <View style={styles.body}>
        {appeal.isSuccess ? (
          <>
            <Text size={14} lineHeight={19.6} color={colors.textMuted}>A safety specialist will review your live first. You'll see the result here and in your notifications.</Text>
            <Button title="Done" onPress={onClose} />
          </>
        ) : (
          <>
            <Text size={14} lineHeight={19.6} color={colors.textMuted}>Tell us why you think your live follows our community guidelines. A person reviews every appeal.</Text>
            <TextInput
              value={message}
              onChangeText={(text) => setMessage(text.slice(0, MAXIMUM_APPEAL_LENGTH))}
              placeholder="Add context for the reviewer (optional)"
              placeholderTextColor={colors.textSubtle}
              selectionColor={colors.primary}
              multiline
              maxLength={MAXIMUM_APPEAL_LENGTH}
              accessibilityLabel="Appeal message"
              style={styles.input}
            />
            {appeal.isError ? (
              <Text size={13} lineHeight={16.9} color={colors.error} accessibilityLiveRegion="polite">
                {appeal.error instanceof Error ? appeal.error.message : "Couldn't send your appeal. Please try again."}
              </Text>
            ) : null}
            <Button title="Send appeal" loading={appeal.isPending} onPress={() => appeal.mutate()} />
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  input: {
    minHeight: 96, padding: 12, borderWidth: 1, borderColor: colors.divider, borderRadius: 8, textAlignVertical: "top",
    fontFamily: fontFamily[400], fontSize: 14, letterSpacing: calculateDefaultLetterSpacing(14), color: colors.text,
  },
}));
