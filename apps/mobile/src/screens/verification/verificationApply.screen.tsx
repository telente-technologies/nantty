import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { SelectableRow } from "@/components/cart/selectableRow";
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
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { paymentsService } from "@/services/payments.service";
import { verificationService } from "@/services/verification.service";
import type { IdentityDocumentType } from "@/types/account.type";
import type { VerificationApplicationInput } from "@/types/verification.type";

export function VerificationApplyScreen({ navigation, route }: MainScreenProps<"VerificationApply">) {
  const { colors } = useTheme();
  const { color } = route.params;
  const queryClient = useQueryClient();
  const plans = useVerificationPlansQuery();
  const plansForColor = (plans.data ?? []).filter((plan) => plan.color === color);
  const [chosenPlanId, setChosenPlanId] = useState<string | null>(null);
  const [legalName, setLegalName] = useState("");
  const [documentType, setDocumentType] = useState<IdentityDocumentType | null>(null);
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentPhotoUrls, setDocumentPhotoUrls] = useState<string[]>([]);
  const [selfieUrls, setSelfieUrls] = useState<string[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessDocumentUrls, setBusinessDocumentUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const idempotencyKey = useRef(generateIdempotencyKey());
  const planId = chosenPlanId ?? plansForColor[0]?.id ?? null;

  const buildInput = (): VerificationApplicationInput =>
    color === "blue"
      ? { kind: "blue", planId: planId!, legalName: legalName.trim(), identityDocument: { documentType: documentType!, documentNumber, documentPhotoUrl: documentPhotoUrls[0]! }, selfiePhotoUrl: selfieUrls[0]! }
      : { kind: "gold", planId: planId!, businessName: businessName.trim(), businessRegistrationNumber: registrationNumber.trim(), businessAddress: businessAddress.trim(), documentUrls: businessDocumentUrls };

  const applyAndPay = useMutation({
    mutationFn: async () => {
      const checkout = await verificationService.submitVerificationApplication(buildInput(), idempotencyKey.current);
      await paymentsService.openHostedCheckoutInAppBrowser(checkout.checkoutUrl);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: verificationQueryKeys.mine });
      navigation.goBack();
    },
  });

  const formComplete =
    color === "blue"
      ? legalName.trim().length > 3 && !!documentType && documentNumber.length >= 6 && documentPhotoUrls.length === 1 && selfieUrls.length === 1
      : businessName.trim().length > 2 && registrationNumber.trim().length >= 5 && businessAddress.trim().length > 5 && businessDocumentUrls.length > 0;

  return (
    <Screen>
      <Header title={color === "blue" ? "Get verified" : "Verify your business"} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text size={16} weight={600} lineHeight={19.2}>Choose a plan</Text>
        {plansForColor.map((plan) => (
          <VerificationPlanCard key={plan.id} plan={plan} selected={plan.id === planId} onPress={() => setChosenPlanId(plan.id)} />
        ))}
        {color === "blue" ? (
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
        ) : (
          <View style={styles.section}>
            <Text size={16} weight={600} lineHeight={19.2}>Business details</Text>
            <TextField label="Registered business name" value={businessName} onChangeText={setBusinessName} />
            <TextField label="CAC registration number" placeholder="e.g. RC 1234567 or BN 3456789" autoCapitalize="characters" value={registrationNumber} onChangeText={setRegistrationNumber} />
            <TextField label="Business address" value={businessAddress} onChangeText={setBusinessAddress} />
            <Text size={14} lineHeight={16.8}>CAC certificate and a utility bill</Text>
            <PhotoEvidencePicker photoUrls={businessDocumentUrls} onChangePhotoUrls={setBusinessDocumentUrls} maximumPhotos={3} addLabel="Add document" onUploadingChange={setUploading} privateUploadPurpose="verification_document" />
          </View>
        )}
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
          Documents are encrypted and only seen by our verification team. You'll pay on our payment partner's page; if we can't verify you, you're refunded.
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        {applyAndPay.isError ? <Text size={12} color={colors.error} align="center">{applyAndPay.error.message}</Text> : null}
        <Button title="Continue to payment" disabled={!planId || !formComplete || uploading} loading={applyAndPay.isPending} onPress={() => applyAndPay.mutate()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  section: { gap: 10, marginTop: 8 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 8 },
});
