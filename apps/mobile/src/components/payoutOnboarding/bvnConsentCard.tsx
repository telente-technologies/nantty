import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { providerWalletQueryKeys } from "@/components/wallet/providerWalletQueries.hook";
import { shouldUseMockForPath } from "@/config/api.config";
import { BVN_CONSENT_RETURN_URL, providerWalletService } from "@/services/money/providerWallet.service";
import { makeThemedStyles, useTheme } from "@/theme";
import { presentPaymentProblem } from "@/utils/paymentProblem.util";

import { payoutQueryKeys } from "./payoutOnboardingQueries.hook";

const statusCopy: Record<string, string> = {
  not_started: "Give consent with your bank so we can confirm the BVN and bank account are yours. It takes a minute.",
  pending: "Waiting for your BVN consent. Finish it in the window that opened, then come back here.",
  verified: "Your BVN is confirmed. Your wallet account number is being set up.",
  failed: "We couldn't confirm your BVN. Check the details you entered, or contact support.",
  manual_review: "We're checking your details by hand. This usually takes a working day.",
};

export function BvnConsentCard({ onVerify }: { readonly onVerify: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const consent = useQuery({
    queryKey: providerWalletQueryKeys.bvnConsent,
    queryFn: providerWalletService.fetchBvnConsent,
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 4000 : false),
  });
  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: providerWalletQueryKeys.bvnConsent });
    void queryClient.invalidateQueries({ queryKey: providerWalletQueryKeys.verification });
    void queryClient.invalidateQueries({ queryKey: providerWalletQueryKeys.wallet });
    void queryClient.invalidateQueries({ queryKey: payoutQueryKeys.state });
  };
  const start = useMutation({
    mutationFn: async () => {
      const started = await providerWalletService.startBvnConsent();
      if (started.consentUrl && !shouldUseMockForPath("/api/v1/payments")) await WebBrowser.openAuthSessionAsync(started.consentUrl, BVN_CONSENT_RETURN_URL).catch(() => null);
      return started;
    },
    onSettled: refreshAll,
    onError: (error) => presentPaymentProblem(error, { onVerify }),
  });
  const status = consent.data?.status ?? "not_started";
  if (status === "verified") return null;
  return (
    <View style={styles.card}>
      <Text size={15} weight={600} lineHeight={19.5}>Confirm your BVN</Text>
      <Text size={13} lineHeight={18} color={colors.textMuted}>{statusCopy[status] ?? statusCopy.pending}</Text>
      {status === "manual_review" ? null : (
        <Button title={status === "pending" ? "Open consent again" : "Give BVN consent"} height={40} loading={start.isPending} onPress={() => start.mutate()} />
      )}
      {status === "pending" ? <Button variant="subtle" title="Check status" height={40} onPress={refreshAll} /> : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.primaryTint, borderRadius: 12, padding: 14, gap: 8 },
}));
