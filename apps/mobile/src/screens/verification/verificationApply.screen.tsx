import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { SelectableRow } from "@/components/cart/selectableRow";
import { MockIapSheet } from "@/components/profile/mockIapSheet";
import { PhotoEvidencePicker } from "@/components/escrow/photoEvidencePicker";
import { VerificationPlanCard } from "@/components/profile/verificationPlanCard";
import { useVerificationPlansQuery, verificationQueryKeys } from "@/components/profile/verificationQueries.hook";
import { IDENTITY_DOCUMENT_OPTIONS } from "@/components/seller/applicationIdentityStep";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { TextField } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { verificationService } from "@/services/auth/verification.service";
import type { IdentityDocumentType } from "@/types/account.type";
import type { VerificationApplicationInput } from "@/types/verification.type";

export function VerificationApplyScreen({ navigation, route }: MainScreenProps<"VerificationApply">) {
  const { colors } = useTheme();
  const color = route.params.color;
  const [iapVisible, setIapVisible] = useState(false);
  const queryClient = useQueryClient();
  const plans = useVerificationPlansQuery();
  const plansForColor = (plans.data ?? []).filter((plan) => plan.color === color);
  const [chosenPlanId, setChosenPlanId] = useState<string | null>(null);
  const [legalName, setLegalName] = useState("");
  const [documentType, setDocumentType] = useState<IdentityDocumentType | null>(null);
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentPhotoUrls, setDocumentPhotoUrls] = useState<string[]>([]);
  const [selfieUrls, setSelfieUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const idempotencyKey = useRef(generateIdempotencyKey());
  const planId = chosenPlanId ?? plansForColor[0]?.id ?? null;

  const buildInput = (): VerificationApplicationInput => ({
    kind: "blue", planId: planId!, legalName: legalName.trim(), identityDocument: { documentType: documentType!, documentNumber, documentPhotoUrl: documentPhotoUrls[0]! }, selfiePhotoUrl: selfieUrls[0]!,
  });

  const applyAndPay = useMutation({
    mutationFn: async () => {
      await verificationService.submitVerificationApplication(buildInput(), idempotencyKey.current);
    },
    onSuccess: async () => {
      setIapVisible(false);
      await queryClient.invalidateQueries({ queryKey: verificationQueryKeys.mine });
      navigation.goBack();
    },
  });

  const formComplete = legalName.trim().length > 3 && !!documentType && documentNumber.length >= 6 && documentPhotoUrls.length === 1 && selfieUrls.length === 1;

  return (
    <Screen>
      <Header title="Get verified" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text size={16} weight={600} lineHeight={19.2}>Choose a plan</Text>
        {plansForColor.map((plan) => (
          <VerificationPlanCard key={plan.id} plan={plan} selected={plan.id === planId} onPress={() => setChosenPlanId(plan.id)} />
        ))}
          <View style={styles.section}>
            <Text size={16} weight={600} lineHeight={19.2}>Identity check</Text>
            <TextField label="Full legal name" placeholder="As it appears on your ID" value={legalName} onChangeText={setLegalName} autoComplete="name" />
            {IDENTITY_DOCUMENT_OPTIONS.map((option) => (
              <SelectableRow key={option.id} selected={documentType === option.id} onPress={() => setDocumentType(option.id)} accessibilityLabel={option.label}>
                <Text size={14} lineHeight={16.8}>{option.label}</Text>
              </SelectableRow>
            ))}
            <TextField label="Document number" password autoCapitalize="characters" autoComplete="off" value={documentNumber} onChangeText={(value) => setDocumentNumber(value.replace(/[^A-Za-z0-9]/g, "").slice(0, 20))} />
            <Text size={14} lineHeight={16.8}>Photo of your ID</Text>
            <PhotoEvidencePicker photoUrls={documentPhotoUrls} onChangePhotoUrls={setDocumentPhotoUrls} maximumPhotos={1} addLabel="Add ID photo" onUploadingChange={setUploading} privateUploadPurpose="identity_document" />
            <Text size={14} lineHeight={16.8}>A selfie holding your ID</Text>
            <PhotoEvidencePicker photoUrls={selfieUrls} onChangePhotoUrls={setSelfieUrls} maximumPhotos={1} addLabel="Add selfie" onUploadingChange={setUploading} privateUploadPurpose="identity_document" />
          </View>
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
          Documents are encrypted and only seen by our verification team. You subscribe with your App Store or Google Play account; if we can't verify you, the purchase is refunded.
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Continue" disabled={!planId || !formComplete || uploading} onPress={() => setIapVisible(true)} />
      </View>
      <MockIapSheet visible={iapVisible} plan={plansForColor.find((plan) => plan.id === planId) ?? null} purchasing={applyAndPay.isPending} errorMessage={applyAndPay.isError ? applyAndPay.error.message : null} onConfirm={() => applyAndPay.mutate()} onClose={() => setIapVisible(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  section: { gap: 10, marginTop: 8 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 8 },
});
