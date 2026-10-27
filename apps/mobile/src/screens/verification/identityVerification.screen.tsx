import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { Platform, ScrollView, StyleSheet, View } from "react-native";

import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { StatusPill } from "@/components/escrow/statusPill";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { IdentityConsentStep, type IdentityCaptureChoice } from "@/components/verification/identityConsentStep";
import { webAppBaseUrl } from "@/config/webAppLinks.config";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { identityVerificationService } from "@/services/auth/identityVerification.service";
import { webHandoffService } from "@/services/core/webHandoff.service";
import { PAYMENT_RETURN_URL } from "@/services/commerce/payments.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { IdentityJourney } from "@/types/identityVerification.type";
import { describeEligibilityReason, describeRefund } from "@/utils/identityVerificationCopy.util";

const journeyKey = ["verification", "journey"] as const;
const returnUrl = "nantty://settings/verification";

function isWaitingForResult(journey: IdentityJourney | undefined): boolean {
  return journey?.case?.status === "processing" || (journey?.case?.status === "awaiting_capture" && journey.case.consentGiven);
}

export function IdentityVerificationScreen({ route }: MainScreenProps<"IdentityVerification">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const journey = useQuery({ queryKey: journeyKey, queryFn: identityVerificationService.fetchVerificationJourney, refetchInterval: (query) => (isWaitingForResult(query.state.data) ? 5000 : false) });
  const request = useMutation({ mutationFn: identityVerificationService.requestVerification, onSuccess: () => queryClient.invalidateQueries({ queryKey: journeyKey }) });
  const capture = useMutation({
    mutationFn: async (choice: IdentityCaptureChoice) => {
      const current = journey.data;
      if (!current?.case) throw new Error("Pay for your checkmark first.");
      const session = await identityVerificationService.startIdentityCapture(current.case.id, {
        consentVersion: current.consentVersion, consentAccepted: true, platform: Platform.OS === "ios" ? "ios" : "android", ...choice,
      });
      if (session.url) await WebBrowser.openAuthSessionAsync(session.url, returnUrl);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: journeyKey }),
  });
  const data = journey.data;
  const openPayment = () =>
    WebBrowser.openAuthSessionAsync(`${webAppBaseUrl}/settings/verification?step=pay&return=${encodeURIComponent(PAYMENT_RETURN_URL)}`, PAYMENT_RETURN_URL)
      .catch(() => null)
      .then(() => queryClient.invalidateQueries({ queryKey: journeyKey }));

  return (
    <Screen>
      <Header title="Get verified" />
      <ScrollView contentContainerStyle={styles.content}>
        {journey.isLoading ? <Text color={colors.textMuted}>Checking your eligibility...</Text> : null}
        {journey.isError ? <Text color={colors.error}>We couldn't load your verification. Pull down to try again.</Text> : null}
        {data ? <JourneyBody journey={data} paymentStepRequested={route.params?.step === "pay"} requesting={request.isPending} requestError={request.isError ? request.error.message : null}
          capturing={capture.isPending} captureError={capture.isError ? capture.error.message : null} onRequest={() => request.mutate()} onPay={openPayment} onCapture={(choice) => capture.mutate(choice)} /> : null}
      </ScrollView>
    </Screen>
  );
}

interface JourneyBodyProps {
  readonly journey: IdentityJourney;
  readonly paymentStepRequested: boolean;
  readonly requesting: boolean;
  readonly requestError: string | null;
  readonly capturing: boolean;
  readonly captureError: string | null;
  readonly onRequest: () => void;
  readonly onPay: () => void;
  readonly onCapture: (choice: IdentityCaptureChoice) => void;
}

function JourneyBody({ journey, paymentStepRequested, requesting, requestError, capturing, captureError, onRequest, onPay, onCapture }: JourneyBodyProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const badgeName = journey.color === "gold" ? "Gold" : "Blue";
  if (journey.blackVetting) {
    return (
      <View style={styles.card}>
        <Text size={16} weight={600}>Black checkmark: government</Text>
        <Text size={13} lineHeight={18} color={colors.textMuted}>Government bodies are verified through official vetting and two independent approvals, not this check.</Text>
        <Button variant="subtle" title="Apply for government verification" onPress={() => webHandoffService.openGovernmentApplication()} />
      </View>
    );
  }
  if (journey.checkmark?.badgeVisible) {
    return (
      <View style={styles.card}>
        <StatusPill label="Verified" tone="success" />
        <Text size={16} weight={600}>You're verified</Text>
        <Text size={13} lineHeight={18} color={colors.textMuted}>Your {badgeName} checkmark is on your profile{journey.case?.verifiedAt ? ` since ${formatFriendlyDate(journey.case.verifiedAt)}` : ""}.</Text>
      </View>
    );
  }
  const verification = journey.case;
  if (verification && verification.status !== "rejected") {
    if (verification.status === "under_review") {
      return <StatusCard pill="Under review" tone="caution" title="A person is reviewing your verification" body="Some checks need a closer look. We'll notify you within 3 days. If we can't approve it, you get a full refund." />;
    }
    if (isWaitingForResult(journey)) {
      return <StatusCard pill="Checking" tone="primary" title="Checking your selfie and ID" body="This usually takes a minute or two. You can leave this screen; we'll notify you." />;
    }
    return (
      <>
        <StatusCard pill="Payment received" tone="success" title="One last step: confirm it's you" body={`Your ${badgeName} checkmark is paid for. Take a selfie and a photo of your ID to finish.`} />
        <IdentityConsentStep starting={capturing} errorMessage={captureError} onStart={onCapture} />
      </>
    );
  }
  const eligibility = journey.eligibility;
  const missing = (eligibility?.reasons ?? []).map(describeEligibilityReason).filter((line): line is string => line !== null);
  return (
    <>
      {verification?.status === "rejected" ? (
        <StatusCard pill="Not approved" tone="error" title="We couldn't verify your account" body={`${verification.decisionReason ? `${verification.decisionReason} ` : ""}${describeRefund(verification.refundMethod, verification.refundStatus, verification.refundScope)}${verification.decidedAt ? ` You can try again 30 days after ${formatFriendlyDate(verification.decidedAt)}.` : ""}`} />
      ) : null}
      <View style={styles.card}>
        <Text size={16} weight={600}>The {badgeName} checkmark</Text>
        <Text size={13} lineHeight={18} color={colors.textMuted}>
          {journey.color === "gold" ? "For businesses and brands. Shows buyers you're a verified business." : "For people, including creators. Shows everyone it's really you."} You pay first, then confirm your identity with a selfie and a government photo ID. If we can't approve you, you get a full refund.
        </Text>
        {eligibility?.canBuyNow ? (
          <>
            <StatusPill label={paymentStepRequested ? "You can now apply" : "You qualify"} tone="success" />
            <Button title="Buy now" onPress={onPay} />
          </>
        ) : eligibility?.state === "requested" ? (
          <>
            <StatusPill label="Request received" tone="primary" />
            <Text size={13} lineHeight={18} color={colors.textMuted}>We'll check your account again regularly and notify you as soon as you can apply.</Text>
          </>
        ) : eligibility?.tier === "blocked" ? (
          <Text size={13} lineHeight={18} color={colors.textMuted}>Verification isn't available for this account right now. Check your account status for details.</Text>
        ) : (
          <Button title="Request verification" loading={requesting} onPress={onRequest} />
        )}
        {missing.length > 0 && !eligibility?.canBuyNow ? (
          <View style={styles.list}>
            <Text size={13} weight={600}>What helps</Text>
            {missing.map((line) => <Text key={line} size={13} lineHeight={18} color={colors.textMuted}>{line}</Text>)}
          </View>
        ) : null}
        {requestError ? <Text size={13} color={colors.error}>{requestError}</Text> : null}
      </View>
    </>
  );
}

function StatusCard({ pill, tone, title, body }: { readonly pill: string; readonly tone: "primary" | "success" | "caution" | "error"; readonly title: string; readonly body: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <StatusPill label={pill} tone={tone} />
      <Text size={16} weight={600}>{title}</Text>
      <Text size={13} lineHeight={18} color={colors.textMuted}>{body}</Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 10, alignItems: "stretch" },
  list: { gap: 4, paddingTop: 4 },
}));
