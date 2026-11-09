import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { CartItem, ReturnRequestInput, ReturnRequestView } from "@/types";
import { makeThemedStyles, useTheme } from "@/theme";
import {
  activeReturnForOrder,
  maxReturnQuantity,
  RETURN_LINE_MAX_COUNT,
  RETURN_REASON_MAX_LENGTH,
  toReturnRequestInput,
  validateReturnDraft,
} from "@/utils/returnRequests.util";

interface ReturnRequestFormProps {
  readonly items: readonly CartItem[];
  readonly knownRequest?: ReturnRequestView;
  readonly submittedRequest?: ReturnRequestView;
  readonly submitting: boolean;
  readonly errorMessage?: string | null;
  readonly onSubmit: (input: ReturnRequestInput) => void;
}

const statusLabel = (status: string) => status.replaceAll("_", " ");

export function ReturnRequestForm({
  items,
  knownRequest,
  submittedRequest,
  submitting,
  errorMessage,
  onSubmit,
}: ReturnRequestFormProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [quantities, setQuantities] = useState<Readonly<Record<string, number>>>({});
  const [reason, setReason] = useState("");
  const activeRequest = knownRequest && activeReturnForOrder(knownRequest.status) ? knownRequest : undefined;
  const validationMessage = validateReturnDraft(items, quantities, reason);
  const selectedCount = items.filter((item) => (quantities[item.id] ?? 0) > 0).length;

  const changeQuantity = (item: CartItem, delta: -1 | 1) => {
    setQuantities((current) => {
      const quantity = current[item.id] ?? 0;
      const next = quantity + delta;
      if (next < 0 || next > maxReturnQuantity(item)) return current;
      const currentSelectedCount = items.filter((candidate) => (current[candidate.id] ?? 0) > 0).length;
      if (delta > 0 && quantity === 0 && currentSelectedCount >= RETURN_LINE_MAX_COUNT) return current;
      return { ...current, [item.id]: next };
    });
  };

  return (
    <View style={styles.card}>
      <Text size={16} weight={600} lineHeight={19.2} accessibilityRole="header">
        Request a return
      </Text>
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>
        Select the items and quantities you want to return. Nantty will review the request with the seller.
      </Text>

      {submittedRequest ? (
        <View style={styles.notice} accessibilityRole="summary">
          <Text size={14} weight={600} lineHeight={16.8}>Return request submitted</Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>
            Status: {statusLabel(submittedRequest.status)}. The seller will review your request.
          </Text>
        </View>
      ) : activeRequest ? (
        <View style={styles.notice} accessibilityRole="summary">
          <Text size={14} weight={600} lineHeight={16.8}>Return request {statusLabel(activeRequest.status)}</Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>
            A request is already on file for this order. The server decides whether another request can be submitted.
          </Text>
        </View>
      ) : (
        <>
          {knownRequest ? (
            <Text size={12} lineHeight={16.8} color={colors.textMuted}>
              Previous request: {statusLabel(knownRequest.status)}.
            </Text>
          ) : null}
          <View style={styles.items}>
            {items.map((item) => {
              const quantity = quantities[item.id] ?? 0;
              const maximum = maxReturnQuantity(item);
              const cannotAddLine = quantity === 0 && selectedCount >= RETURN_LINE_MAX_COUNT;
              return (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemText}>
                    <Text size={14} weight={500} lineHeight={16.8} numberOfLines={2}>{item.product.name}</Text>
                    <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
                      Purchased {item.quantity}{item.variant ? ` · ${item.variant}` : ""}
                    </Text>
                  </View>
                  <View style={styles.stepper}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove one ${item.product.name} from return`}
                      accessibilityState={{ disabled: quantity === 0 }}
                      disabled={quantity === 0}
                      onPress={() => changeQuantity(item, -1)}
                      style={[styles.stepButton, quantity === 0 && styles.disabledStep]}
                    >
                      <Text size={18} lineHeight={20} color={quantity === 0 ? colors.disabledText : colors.text}>−</Text>
                    </Pressable>
                    <Text size={14} weight={500} lineHeight={16.8} accessibilityLabel={`${quantity} selected to return`}>
                      {quantity}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add one ${item.product.name} to return`}
                      accessibilityState={{ disabled: quantity >= maximum || cannotAddLine }}
                      disabled={quantity >= maximum || cannotAddLine}
                      onPress={() => changeQuantity(item, 1)}
                      style={[styles.stepButton, (quantity >= maximum || cannotAddLine) && styles.disabledStep]}
                    >
                      <Text size={18} lineHeight={20} color={quantity >= maximum || cannotAddLine ? colors.disabledText : colors.text}>+</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
          {items.length > RETURN_LINE_MAX_COUNT ? (
            <Text size={12} lineHeight={16.8} color={colors.textMuted}>
              You can include up to {RETURN_LINE_MAX_COUNT} different items in one request.
            </Text>
          ) : null}
          <View style={styles.field}>
            <Text size={14} weight={500} lineHeight={16.8}>Reason for return</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              maxLength={RETURN_REASON_MAX_LENGTH}
              multiline
              textAlignVertical="top"
              placeholder="Tell the seller why you’re requesting a return."
              placeholderTextColor={colors.textSubtle}
              accessibilityLabel="Reason for return"
              style={styles.reasonInput}
            />
            <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
              {reason.trim().length}/{RETURN_REASON_MAX_LENGTH} characters · minimum 5
            </Text>
          </View>
          {validationMessage ? (
            <Text size={12} lineHeight={16.8} color={colors.textMuted}>{validationMessage}</Text>
          ) : null}
          {errorMessage ? (
            <Text size={12} lineHeight={16.8} color={colors.error} accessibilityRole="alert">{errorMessage}</Text>
          ) : null}
          <Button
            title="Submit return request"
            loading={submitting}
            disabled={Boolean(validationMessage)}
            onPress={() => onSubmit(toReturnRequestInput(items, quantities, reason))}
          />
        </>
      )}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 12 },
  notice: { backgroundColor: colors.primaryTint, borderRadius: 8, padding: 12, gap: 4 },
  items: { gap: 8 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  itemText: { flex: 1, gap: 4 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepButton: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center" },
  disabledStep: { backgroundColor: colors.background },
  field: { gap: 8 },
  reasonInput: {
    minHeight: 104,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textSubtle,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 14,
    textAlignVertical: "top",
  },
}));
