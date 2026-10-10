import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pressable, StyleSheet, View } from "react-native";

import { BellRinging24Icon, BellSlash24Icon, Hourglass24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { chatSafetyService } from "@/services/chat/chatSafety.service";
import type { ChatMuteDuration } from "@/types";

const MUTE_CHOICES: readonly { readonly duration: ChatMuteDuration; readonly label: string }[] = [
  { duration: "8h", label: "Mute for 8 hours" },
  { duration: "1w", label: "Mute for 1 week" },
  { duration: "always", label: "Mute always" },
];

export interface ChatMuteSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly conversationId: string;
  readonly isMuted: boolean;
}

export function ChatMuteSheet({ visible, onClose, conversationId, isMuted }: ChatMuteSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const setMute = useMutation({
    mutationFn: (duration: ChatMuteDuration) => chatSafetyService.setConversationMute(conversationId, duration),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onClose();
    },
  });
  const choices = isMuted ? [...MUTE_CHOICES, { duration: "off" as const, label: "Unmute" }] : MUTE_CHOICES;
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Notifications for this chat">
      <View style={styles.list}>
        {choices.map((choice) => (
          <Pressable key={choice.duration} accessibilityRole="button" disabled={setMute.isPending} onPress={() => setMute.mutate(choice.duration)} style={styles.row}>
            {choice.duration === "off" ? (
              <BellRinging24Icon size={20} color={colors.primary} />
            ) : choice.duration === "always" ? (
              <BellSlash24Icon size={20} color={colors.textMuted} />
            ) : (
              <Hourglass24Icon size={20} color={colors.textMuted} />
            )}
            <Text size={15} lineHeight={20} color={choice.duration === "off" ? colors.primary : colors.text}>{choice.label}</Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.divider },
}));
