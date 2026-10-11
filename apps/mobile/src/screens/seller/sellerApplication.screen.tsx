import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ApplicationIdentityStep } from "@/components/seller/applicationIdentityStep";
import { ApplicationPayoutStep } from "@/components/seller/applicationPayoutStep";
import { ApplicationReviewStep } from "@/components/seller/applicationReviewStep";
import { ApplicationStepHeader } from "@/components/seller/applicationStepHeader";
import { ApplicationContactStep, ApplicationStoreStep } from "@/components/seller/applicationStoreAndContactSteps";
import { sellerQueryKeys } from "@/components/seller/sellerQueries.hook";
import { Button } from "@/components/ui/button";
import { KeyboardAwareForm } from "@/components/ui/keyboardAwareForm";
import { Header } from "@/components/ui/header";
import { ProfileLimitGate } from "@/components/profile/profileLimitGate";
import { linkedProfilesQueryKey } from "@/hooks/useLinkedProfiles.hook";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { sellerService } from "@/services/sellers/seller.service";
import type { SellerApplicationDraft, SellerApplicationInput } from "@/types/account.type";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { describeActionFailure } from "@/errors/errorExperience/describeError";

const EMPTY_DRAFT: SellerApplicationDraft = {
  storeName: "", categoryId: "", description: "", phone: "", addressLine: "", city: "", state: "",
  identityDocumentType: null, identityDocumentNumber: "", identityDocumentPhotoUrl: null,
  payoutBankCode: "", payoutBankName: "", payoutAccountNumber: "", payoutAccountName: "",
};

const STEPS = [
  { title: "Tell us about your store", subtitle: "This is what buyers see first.", isComplete: (d: SellerApplicationDraft) => d.storeName.trim().length >= 3 && !!d.categoryId && d.description.trim().length >= 20 },
  { title: "How can buyers and couriers reach you?", subtitle: "We use this for pickups and order updates.", isComplete: (d: SellerApplicationDraft) => d.phone.replace(/\D/g, "").length >= 10 && !!d.addressLine.trim() && !!d.city.trim() && !!d.state },
  { title: "Verify your identity", subtitle: "Required by law so buyers can trust every seller. Your ID number is never shown in full.", isComplete: (d: SellerApplicationDraft) => !!d.identityDocumentType && d.identityDocumentNumber.length >= 6 && !!d.identityDocumentPhotoUrl },
  { title: "Where should we pay you?", subtitle: "Money released from escrow is sent here.", isComplete: (d: SellerApplicationDraft) => !!d.payoutBankCode && d.payoutAccountNumber.length === 10 && !!d.payoutAccountName },
  { title: "Review and submit", subtitle: "Tap any row to change it.", isComplete: () => true },
] as const;

const convertDraftToSubmission = (draft: SellerApplicationDraft): SellerApplicationInput => ({
  storeName: draft.storeName.trim(),
  categoryId: draft.categoryId,
  description: draft.description.trim(),
  phone: draft.phone.replace(/\s/g, ""),
  addressLine: draft.addressLine.trim(),
  city: draft.city.trim(),
  state: draft.state,
  identityDocument: { documentType: draft.identityDocumentType!, documentNumber: draft.identityDocumentNumber, documentPhotoUrl: draft.identityDocumentPhotoUrl! },
  payoutAccount: { bankCode: draft.payoutBankCode, accountNumber: draft.payoutAccountNumber },
});

export function SellerApplicationScreen({ navigation }: MainScreenProps<"SellerApplication">) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SellerApplicationDraft>(EMPTY_DRAFT);
  const [stepIndex, setStepIndex] = useState(0);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const idempotencyKeyForThisApplication = useRef(generateIdempotencyKey());
  const existingApplication = useQuery({ queryKey: sellerQueryKeys.application, queryFn: sellerService.fetchMySellerApplication });

  useEffect(() => {
    if (existingApplication.data?.status === "pending") navigation.replace("SellerApplicationStatus");
  }, [existingApplication.data, navigation]);

  const submitApplication = useMutation({
    mutationFn: () => sellerService.submitSellerApplication(convertDraftToSubmission(draft), idempotencyKeyForThisApplication.current),
    onSuccess: (application) => {
      setDraft(EMPTY_DRAFT);
      queryClient.setQueryData(sellerQueryKeys.application, application);
      queryClient.invalidateQueries({ queryKey: linkedProfilesQueryKey });
      navigation.replace("SellerApplicationStatus");
    },
  });

  const updateDraft = (patch: Partial<SellerApplicationDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const step = STEPS[stepIndex]!;
  const isLastStep = stepIndex === STEPS.length - 1;
  const goBackOneStep = () => (stepIndex === 0 ? navigation.goBack() : setStepIndex(stepIndex - 1));

  if (existingApplication.isLoading) {
    return (
      <Screen>
        <Header title="Start selling" />
        <ListSkeleton />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Start selling" onBack={goBackOneStep} />
      <ProfileLimitGate kind="store" failure={submitApplication.error}>
      <KeyboardAwareForm
        contentContainerStyle={styles.content}
        footerStyle={styles.footer}
        footer={
          <>
            {submitApplication.isError ? (
              <Text size={12} lineHeight={16} color={colors.error} align="center" accessibilityRole="alert">{describeActionFailure(submitApplication.error)}</Text>
            ) : null}
            <Button
              title={isLastStep ? "Submit application" : "Continue"}
              disabled={!step.isComplete(draft) || uploadingDocument || (isLastStep && !STEPS.every((s) => s.isComplete(draft)))}
              loading={submitApplication.isPending}
              onPress={() => (isLastStep ? submitApplication.mutate() : setStepIndex(stepIndex + 1))}
            />
          </>
        }
      >
        <ApplicationStepHeader stepNumber={stepIndex + 1} totalSteps={STEPS.length} title={step.title} subtitle={step.subtitle} />
        {stepIndex === 0 ? <ApplicationStoreStep draft={draft} onChange={updateDraft} /> : null}
        {stepIndex === 1 ? <ApplicationContactStep draft={draft} onChange={updateDraft} /> : null}
        {stepIndex === 2 ? <ApplicationIdentityStep draft={draft} onChange={updateDraft} onUploadingChange={setUploadingDocument} /> : null}
        {stepIndex === 3 ? <ApplicationPayoutStep draft={draft} onChange={updateDraft} /> : null}
        {stepIndex === 4 ? <ApplicationReviewStep draft={draft} onEditStep={setStepIndex} /> : null}
      </KeyboardAwareForm>
      </ProfileLimitGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 24 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 8 },
});
