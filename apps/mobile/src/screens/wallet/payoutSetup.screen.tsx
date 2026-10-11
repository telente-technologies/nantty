import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet } from "react-native";

import { AccountSetupPanel } from "@/components/payoutOnboarding/accountSetupPanel";
import { BankStep } from "@/components/payoutOnboarding/bankStep";
import { BvnConsentCard } from "@/components/payoutOnboarding/bvnConsentCard";
import { useProviderWallet } from "@/components/wallet/providerWalletQueries.hook";
import { BusinessStep } from "@/components/payoutOnboarding/businessStep";
import { DocumentStep } from "@/components/payoutOnboarding/documentStep";
import { IdentityStep } from "@/components/payoutOnboarding/identityStep";
import { PayoutStatusPanel } from "@/components/payoutOnboarding/payoutStatusPanel";
import { payoutQueryKeys, usePayoutOnboardingQuery } from "@/components/payoutOnboarding/payoutOnboardingQueries.hook";
import { StepSyncList } from "@/components/payoutOnboarding/stepSyncList";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";

export function PayoutSetupScreen({ navigation, route }: MainScreenProps<"PayoutSetup">) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const context = route.params?.context ?? "seller";
  const { data: state, isError, error } = usePayoutOnboardingQuery();
  const [editing, setEditing] = useState(false);
  const { verification } = useProviderWallet();
  const needsBvnConsent = !!state && verification.data?.country === "NG" && !verification.data.payoutVerified && state.idType === "bvn" && state.completedSteps.includes("bank");
  const refresh = () => queryClient.invalidateQueries({ queryKey: payoutQueryKeys.state });

  const stepCount = 2 + (state?.requiresBusinessStep ? 1 : 0) + (state?.requiresDocumentStep ? 1 : 0);
  const stepNumber = state ? { identity: 1, business: 2, bank: state.requiresBusinessStep ? 3 : 2, document: stepCount }[state.currentStep] : 1;
  const showStatus = !!state && (state.status === "pending_review" || state.status === "verified" || (state.status === "action_needed" && !editing));
  const accountFailedEarly = !!state && !showStatus && state.accountStatus === "failed" && state.currentStep !== "document";

  return (
    <Screen>
      <Header title="Get paid" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {isError ? <Text color={colors.error}>{error.message}</Text> : null}
        {!state && !isError ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
        {needsBvnConsent ? <BvnConsentCard onVerify={() => setEditing(true)} /> : null}
        {state && showStatus ? (
          <PayoutStatusPanel
            state={state}
            context={context}
            onFix={() => setEditing(true)}
            onDone={() => (context === "creator" ? navigation.goBack() : navigation.navigate("Wallet"))}
          />
        ) : null}
        {state && !showStatus ? (
          <>
            {state.completedSteps.length > 0 ? <StepSyncList state={state} /> : null}
            {accountFailedEarly ? <AccountSetupPanel state={state} onChanged={refresh} /> : null}
            {state.currentStep === "identity" ? <IdentityStep state={state} stepCount={stepCount} onSaved={refresh} /> : null}
            {state.currentStep === "business" ? <BusinessStep stepCount={stepCount} onSaved={refresh} /> : null}
            {state.currentStep === "bank" ? <BankStep state={state} stepNumber={stepNumber} stepCount={stepCount} onSaved={refresh} /> : null}
            {state.currentStep === "document" ? <DocumentStep state={state} stepNumber={stepNumber} stepCount={stepCount} onChanged={refresh} /> : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 16 },
  loading: { marginTop: 40 },
});
