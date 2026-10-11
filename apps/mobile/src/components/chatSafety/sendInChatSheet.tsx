import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { describeConversationForDisplay } from "@/components/chat/conversationDisplay.util";
import { Avatar } from "@/components/ui/avatar";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { TextField } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { chatCryptoService, readChatCryptoErrorMessage } from "@/services/chatCrypto/chatCrypto.service";
import { chatSafetyService } from "@/services/chat/chatSafety.service";
import { messagesService } from "@/services/chat/messages.service";
import type { Conversation, SharedContentReference } from "@/types";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { Check16Icon, PaperPlaneTilt24Icon } from "@/components/icons";

export interface SendInChatSheetProps {
  readonly reference: SharedContentReference | null;
  readonly onClose: () => void;
}

const canPostInConversation = (conversation: Conversation) => (conversation.kind ?? "direct") !== "channel" || conversation.myRole !== "subscriber";

export function SendInChatSheet({ reference, onClose }: SendInChatSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [selectedConversationIds, setSelectedConversationIds] = useState<readonly string[]>([]);
  const [note, setNote] = useState("");
  const chats = useQuery({ queryKey: ["conversations", "share-targets"], queryFn: () => messagesService.fetchConversationList("all"), enabled: !!reference });
  const send = useMutation({
    mutationFn: async () => {
      const text = note.trim();
      if (!text) return chatSafetyService.sendContentToChats({ conversationIds: selectedConversationIds, reference: reference! });
      const selected = (chats.data ?? []).filter((conversation) => selectedConversationIds.includes(conversation.id));
      const sealed = await Promise.all(selected.map(async (conversation) => ({ conversationId: conversation.id, encrypted: await chatCryptoService.encryptForConversation(conversation, { text, sharedContent: reference! }) })));
      const result = await chatSafetyService.sendContentToChats({
        conversationIds: selectedConversationIds, reference: reference!,
        encryptions: sealed.map(({ conversationId, encrypted }) => ({ conversationId, deviceId: encrypted.encryption.deviceId, ciphertext: encrypted.encryption.ciphertext })),
      });
      await Promise.all(sealed.map(({ encrypted }) => encrypted.confirmSent(null)));
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onClose();
      showAlertWithButtons("Sent", `Shared in ${result.sentCount} ${result.sentCount === 1 ? "chat" : "chats"}.`, undefined, { intent: "share" });
    },
    onError: (error) => showAlertWithButtons("Couldn't send", readChatCryptoErrorMessage(error) ?? (error instanceof Error ? error.message : undefined), undefined, { intent: "share" }),
  });

  useEffect(() => {
    if (!reference) {
      setSelectedConversationIds([]);
      setNote("");
    }
  }, [reference]);

  const toggle = (conversationId: string) =>
    setSelectedConversationIds((current) => (current.includes(conversationId) ? current.filter((id) => id !== conversationId) : [...current, conversationId]));

  return (
    <BottomSheet visible={!!reference} onClose={onClose} title="Send in chat">
      <View style={styles.body}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          <PaperPlaneTilt24Icon size={22} color={colors.textMuted} />
        </View>
        {chats.isLoading ? (
          <ListSkeleton rows={4} avatarSize={40} />
        ) : chats.isError ? (
          <ErrorState error={chats.error} message="Couldn't load your chats." onRetry={() => chats.refetch()} />
        ) : (
          <FlatList
            style={styles.list}
            data={(chats.data ?? []).filter(canPostInConversation)}
            keyExtractor={(conversation) => conversation.id}
            ListEmptyComponent={<Text size={13} lineHeight={18} color={colors.textMuted} align="center">You have no chats yet.</Text>}
            renderItem={({ item }) => {
              const display = describeConversationForDisplay(item);
              const isSelected = selectedConversationIds.includes(item.id);
              return (
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: isSelected }} onPress={() => toggle(item.id)} style={styles.row}>
                  <Avatar uri={display.avatarUrl} size={40} placeholderColor={colors.primaryTint} />
                  <Text size={14} weight={500} lineHeight={17} numberOfLines={1} style={styles.name}>{display.displayName}</Text>
                  <View style={[styles.check, isSelected && styles.checkSelected]}>
                    {isSelected ? <Check16Icon size={14} color={colors.white} /> : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
        <TextField label="Add a note (optional)" value={note} onChangeText={setNote} maxLength={1000} />
        <Button title={selectedConversationIds.length > 1 ? `Send to ${selectedConversationIds.length} chats` : "Send"} disabled={selectedConversationIds.length === 0} loading={send.isPending} onPress={() => send.mutate()} />
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  list: { maxHeight: 300 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  name: { flex: 1 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.divider, alignItems: "center", justifyContent: "center" },
  checkSelected: { backgroundColor: colors.primarySolid, borderColor: colors.primary },
}));
