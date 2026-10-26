import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { ApiError } from "@/errors/api.error";
import { payoutOnboardingService } from "@/services/commerce/payoutOnboarding.service";
import type { PayoutOnboardingState } from "@/types/payoutOnboarding.type";

import { AccountSetupPanel } from "./accountSetupPanel";
import { StepFrame } from "./stepFrame";

interface DocumentStepProps {
  readonly state: PayoutOnboardingState;
  readonly stepNumber: number;
  readonly stepCount: number;
  readonly onChanged: () => Promise<unknown> | void;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function DocumentStep({ state, stepNumber, stepCount, onChanged }: DocumentStepProps) {
  const { colors } = useTheme();
  const [checking, setChecking] = useState(false);
  const verify = useMutation({
    mutationFn: async () => {
      const link = await payoutOnboardingService.createDocumentLink();
      const outcome = await payoutOnboardingService.openSecureVerificationPage(link);
      if (outcome === "returned") {
        setChecking(true);
        for (let attempt = 0; attempt < 5; attempt += 1) {
          await wait(1500);
          await onChanged();
        }
      }
      return outcome;
    },
    onSettled: () => {
      setChecking(false);
      onChanged();
    },
  });

  if (state.accountStatus === "failed") return <AccountSetupPanel state={state} onChanged={onChanged} />;
  if (state.accountStatus !== "documentsRequired") {
    return (
      <View style={styles.wait} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.primary} />
        <Text size={16} weight={600} lineHeight={20} align="center">We're setting up your payout account</Text>
        <Text size={14} lineHeight={20} align="center" color={colors.textMuted}>You can verify your ID once it's ready. We'll notify you. Everything else keeps working.</Text>
      </View>
    );
  }
  if (checking) {
    return (
      <View style={styles.wait} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.primary} />
        <Text size={16} weight={600} lineHeight={20} align="center">Checking your documents…</Text>
      </View>
    );
  }
  const unfinished = state.documentStatus === "link_issued" && !verify.isError;
  const unavailable = verify.error instanceof ApiError && verify.error.status === 503;

  return (
    <StepFrame
      stepNumber={stepNumber}
      stepCount={stepCount}
      title={unfinished ? "Verify your ID: not finished" : "Verify your ID"}
      why="A photo of your government ID is the last check. It is collected on a secure verification page, so the image never passes through the Nantty app."
    >
      <Text size={14} lineHeight={20}>
        A secure page opens inside the app. Upload your ID there and you come straight back here. Your progress is already saved.
      </Text>
      <Text size={13} lineHeight={18} color={colors.textMuted}>Accepted: national ID card, international passport, driver's licence or voter's card. Photos must be clear and show all four corners.</Text>
      {unavailable ? <Text size={13} lineHeight={18} color={colors.error}>We couldn't open the verification page right now. Try again in a moment.</Text> : null}
      {verify.isError && !unavailable ? <Text size={12} lineHeight={14.4} color={colors.error}>{verify.error.message}</Text> : null}
      <Button title={unavailable ? "Try again" : unfinished ? "Continue" : "Open secure verification"} loading={verify.isPending} onPress={() => verify.mutate()} />
    </StepFrame>
  );
}

const styles = StyleSheet.create({ wait: { gap: 12, paddingVertical: 24, alignItems: "stretch" } });
