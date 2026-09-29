import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";

import { SelectableRow } from "@/components/cart/selectableRow";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { fontFamily } from "@/constants/typography.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { ordersService } from "@/services/orders.service";
import type { DisputeReason } from "@/types/commerce.type";

const REASONS: { id: DisputeReason; label: string }[] = [
  { id: "not_received", label: "I didn't receive my order" },
  { id: "not_as_described", label: "Item isn't as described" },
  { id: "damaged", label: "Item arrived damaged" },
  { id: "wrong_item", label: "I received the wrong item" },
  { id: "other", label: "Something else" },
];

export function OpenDisputeScreen({ navigation, route }: MainScreenProps<"OpenDispute">) {
  const { orderId } = route.params;
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [details, setDetails] = useState("");
  const disputeKey = useRef(generateIdempotencyKey());

  const submitDispute = useMutation({
    mutationFn: () => ordersService.openOrderDispute(orderId, reason!, details.trim(), disputeKey.current),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      navigation.goBack();
    },
  });

  return (
    <Screen>
      <Header title="Report a problem" paddingHorizontal={12} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text size={13} lineHeight={16.9} color={colors.textMuted}>
          Opening a dispute pauses the escrow release. Our team will review it with you and the seller.
        </Text>
        <View style={styles.reasons}>
          {REASONS.map((option) => (
            <SelectableRow key={option.id} selected={reason === option.id} onPress={() => setReason(option.id)} accessibilityLabel={option.label}>
              <Text size={14} lineHeight={16.8}>{option.label}</Text>
            </SelectableRow>
          ))}
        </View>
        <View style={styles.field}>
          <Text size={14} lineHeight={16.8}>Tell us what happened</Text>
          <TextInput
            value={details}
            onChangeText={setDetails}
            multiline
            maxLength={1000}
            placeholder="Add details that will help us resolve this"
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel="Dispute details"
            style={styles.input}
          />
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {submitDispute.isError ? (
          <Text size={12} lineHeight={14.4} color={colors.error} align="center" accessibilityRole="alert">
            Couldn't open the dispute. Try again.
          </Text>
        ) : null}
        <Button title="Submit" disabled={!reason || details.trim().length < 10} loading={submitDispute.isPending} onPress={() => submitDispute.mutate()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 20 },
  reasons: { gap: 8 },
  field: { gap: 8 },
  input: {
    minHeight: 120,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textSubtle,
    backgroundColor: colors.white,
    textAlignVertical: "top",
    fontFamily: fontFamily[400],
    fontSize: 14,
    color: colors.text,
  },
  footer: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
});
