import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { PhotoEvidencePicker } from "@/components/escrow/photoEvidencePicker";
import { TICKET_CATEGORY_OPTIONS } from "@/components/settings/supportAppearance.util";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Header } from "@/components/ui/header";
import { TextField } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { ordersService } from "@/services/commerce/orders.service";
import { supportService } from "@/services/support/support.service";
import type { SupportLinkedReference, SupportTicketCategory } from "@/types/support.type";

import { supportTicketsQueryKey } from "./supportTickets.screen";

export function NewSupportTicketScreen({ navigation, route }: MainScreenProps<"NewSupportTicket">) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<SupportTicketCategory>(route.params?.category ?? "order");
  const [linkedReference, setLinkedReference] = useState<SupportLinkedReference | null>(route.params?.linkedReference ?? null);
  const recentOrders = useQuery({ queryKey: ["orders", "support-link"], queryFn: () => ordersService.fetchMyOrders(null), enabled: !linkedReference && (category === "order" || category === "payment") });
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const idempotencyKey = useRef(generateIdempotencyKey());
  const createTicket = useMutation({
    mutationFn: () => supportService.createSupportTicket({ category, subject: subject.trim(), message: message.trim(), attachmentUrls, linkedReference }, idempotencyKey.current),
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: supportTicketsQueryKey });
      navigation.replace("SupportTicketDetail", { ticketId: ticket.id });
    },
  });

  return (
    <Screen>
      <Header title="Contact support" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text size={14} lineHeight={16.8}>What do you need help with?</Text>
        <View style={styles.chips}>
          {TICKET_CATEGORY_OPTIONS.map((option) => (
            <Chip key={option.id} kind="topic" label={option.label} selected={category === option.id} onPress={() => setCategory(option.id)} />
          ))}
        </View>
        {linkedReference ? (
          <Chip kind="topic" label={`${linkedReference.label} (tap to remove)`} selected onPress={() => setLinkedReference(null)} />
        ) : (recentOrders.data ?? []).length > 0 ? (
          <>
            <Text size={14} lineHeight={16.8}>Link an order or payment (optional)</Text>
            <View style={styles.chips}>
              {(recentOrders.data ?? []).slice(0, 4).map((order) => (
                <Chip key={order.id} kind="topic" label={`Order ${order.reference}`} onPress={() => setLinkedReference({ kind: category === "payment" ? "payment" : "order", id: order.id, label: `${category === "payment" ? "Payment for order" : "Order"} ${order.reference}` })} />
              ))}
            </View>
          </>
        ) : null}
        <TextField label="Subject" placeholder="e.g. My order hasn't arrived" value={subject} onChangeText={setSubject} maxLength={80} />
        <TextField label="Tell us more" placeholder="Include order numbers and what you've tried" value={message} onChangeText={setMessage} multiline maxLength={1500} boxStyle={styles.multiline} />
        <Text size={14} lineHeight={16.8}>Screenshots (optional)</Text>
        <PhotoEvidencePicker photoUrls={attachmentUrls} onChangePhotoUrls={setAttachmentUrls} maximumPhotos={3} addLabel="Add screenshot" onUploadingChange={setUploading} />
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>Never share your password, card PIN or OTP. Zudomart will never ask for them.</Text>
      </ScrollView>
      <View style={styles.footer}>
        {createTicket.isError ? <Text size={12} color={colors.error} align="center">{createTicket.error.message}</Text> : null}
        <Button title="Send" disabled={subject.trim().length < 4 || message.trim().length < 10 || uploading} loading={createTicket.isPending} onPress={() => createTicket.mutate()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  multiline: { height: 140, alignItems: "flex-start", paddingVertical: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 8 },
});
