import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { SelectableRow } from "@/components/cart/selectableRow";
import { escrowQueryKeys } from "@/components/escrow/escrowQueries.hook";
import { DISPUTE_REASON_OPTIONS } from "@/components/escrow/escrowStage.util";
import { PhotoEvidencePicker } from "@/components/escrow/photoEvidencePicker";
import { Button } from "@/components/ui/button";
import { KeyboardAwareForm } from "@/components/ui/keyboardAwareForm";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { fontFamily } from "@/constants/typography.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { disputesService } from "@/services/moderation/disputes.service";
import type { DisputeReason } from "@/types/commerce.type";
import { describeActionFailure } from "@/errors/errorExperience/describeError";

const MINIMUM_DESCRIPTION_LENGTH = 20;
const REASONS_THAT_NEED_PHOTOS = new Set<DisputeReason>(["damaged", "not_as_described", "wrong_item"]);

export function OpenDisputeScreen({ navigation, route }: MainScreenProps<"OpenDispute">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { orderId } = route.params;
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [description, setDescription] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const idempotencyKeyForThisDispute = useRef(generateIdempotencyKey());

  const submitDispute = useMutation({
    mutationFn: () =>
      disputesService.openDisputeForOrder(orderId, { reason: reason!, description: description.trim(), evidenceUrls }, idempotencyKeyForThisDispute.current),
    onSuccess: (dispute) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: escrowQueryKeys.forOrder(orderId) });
      queryClient.setQueryData(escrowQueryKeys.dispute(dispute.id), dispute);
      navigation.replace("DisputeDetail", { disputeId: dispute.id });
    },
  });

  const photosRequired = reason !== null && REASONS_THAT_NEED_PHOTOS.has(reason);
  const descriptionLongEnough = description.trim().length >= MINIMUM_DESCRIPTION_LENGTH;
  const readyToSubmit = !!reason && descriptionLongEnough && (!photosRequired || evidenceUrls.length > 0) && !uploadingEvidence;

  return (
    <Screen>
      <Header title="Open a dispute" />
      <KeyboardAwareForm
        contentContainerStyle={styles.content}
        footerStyle={styles.footer}
        footer={
          <>
            {submitDispute.isError ? (
              <Text size={12} lineHeight={14.4} color={colors.error} align="center" accessibilityRole="alert">
                {describeActionFailure(submitDispute.error) || "Couldn't open the dispute. Try again."}
              </Text>
            ) : null}
            <Button title="Submit dispute" disabled={!readyToSubmit} loading={submitDispute.isPending} onPress={() => submitDispute.mutate()} />
          </>
        }
      >
        <View style={styles.notice}>
          <Text size={13} weight={500} lineHeight={16.9} color={colors.primary}>
            Your payment is paused while we look into this
          </Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>
            The seller can't receive the money until the dispute is resolved. They have 48 hours to respond, then Zudomart support steps in.
          </Text>
        </View>

        <Text size={16} weight={600} lineHeight={19.2} accessibilityRole="header">
          What went wrong?
        </Text>
        <View style={styles.reasons} accessibilityRole="radiogroup">
          {DISPUTE_REASON_OPTIONS.map((option) => (
            <SelectableRow key={option.id} selected={reason === option.id} onPress={() => setReason(option.id)} accessibilityLabel={option.label}>
              <Text size={14} lineHeight={16.8}>{option.label}</Text>
              <Text size={12} lineHeight={16.8} color={colors.textSubtle}>{option.hint}</Text>
            </SelectableRow>
          ))}
        </View>

        <View style={styles.field}>
          <Text size={16} weight={600} lineHeight={19.2}>Describe the problem</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={1000}
            placeholder="E.g. The heel of the left shoe is peeling and there's a glue stain on the toe."
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel="Describe the problem"
            style={styles.input}
          />
          <Text size={12} lineHeight={16} color={descriptionLongEnough ? colors.textSubtle : colors.caution}>
            {descriptionLongEnough ? `${description.trim().length}/1000` : `At least ${MINIMUM_DESCRIPTION_LENGTH} characters`}
          </Text>
        </View>

        <View style={styles.field}>
          <Text size={16} weight={600} lineHeight={19.2}>Photo evidence{photosRequired ? "" : " (optional)"}</Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>
            Clear photos of the item, packaging and label help us resolve this faster. Only you, the seller and Zudomart support can see them.
          </Text>
          <PhotoEvidencePicker photoUrls={evidenceUrls} onChangePhotoUrls={setEvidenceUrls} onUploadingChange={setUploadingEvidence} />
        </View>
      </KeyboardAwareForm>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 16 },
  notice: { backgroundColor: colors.primaryTint, borderRadius: 12, padding: 12, gap: 4 },
  reasons: { gap: 8 },
  field: { gap: 8 },
  input: {
    minHeight: 120,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textSubtle,
    backgroundColor: colors.surface,
    textAlignVertical: "top",
    fontFamily: fontFamily[400],
    fontSize: 14,
    color: colors.text,
  },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 8 },
}));
