import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Shield24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useProviderWallet } from "@/components/wallet/providerWalletQueries.hook";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { paymentsService } from "@/services/commerce/payments.service";
import { useOfflineStore } from "@/store/offline.store";
import { ESCROW_NOTE_ELSEWHERE, ESCROW_NOTE_NIGERIA } from "@/utils/paymentCopy.util";
import { pollPaymentUntilSettled } from "@/utils/paymentPolling.util";
import { saveCardOnThisDevice } from "@/utils/savedCard.util";

type PaymentStatus = "opening" | "checking" | "offline" | "waiting" | "failed";

const headings: Record<PaymentStatus, string> = {
  opening: "Opening secure payment…",
  checking: "Confirming payment…",
  offline: "You're offline",
  waiting: "Still confirming your payment",
  failed: "Payment didn't go through",
};

export function PaymentScreen({ navigation, route }: MainScreenProps<"Payment">) {
  const { colors } = useTheme();
  const { orderId } = route.params;
  const [authorizationUrl, setAuthorizationUrl] = useState(route.params.authorizationUrl);
  const [status, setStatus] = useState<PaymentStatus>("opening");
  const openedOnce = useRef(false);
  const polling = useRef(false);
  const unmounted = useRef(false);
  const { isNigeria } = useProviderWallet();
  useEffect(() => () => void (unmounted.current = true), []);

  const verifyWithServerUntilSettled = useCallback(async () => {
    if (polling.current) return;
    polling.current = true;
    setStatus(useOfflineStore.getState().isOnline ? "checking" : "offline");
    const outcome = await pollPaymentUntilSettled({
      isOnline: () => useOfflineStore.getState().isOnline,
      isCancelled: () => unmounted.current,
      onOfflineChange: (offline) => setStatus(offline ? "offline" : "checking"),
      check: async () => {
        const result = await paymentsService.verifyOrderPayment(orderId);
        if (result.status === "paid" && result.savedCard) await saveCardOnThisDevice(result.savedCard).catch(() => undefined);
        return result.status;
      },
    });
    polling.current = false;
    if (outcome === "cancelled") return;
    if (outcome === "paid") navigation.replace("OrderSuccess", { orderId });
    else setStatus(outcome === "failed" ? "failed" : "waiting");
  }, [navigation, orderId]);

  const openCheckoutThenVerify = useCallback(async (url: string | undefined) => {
    if (polling.current) return;
    if (url) {
      setStatus("opening");
      await paymentsService.openHostedCheckoutInAppBrowser(url).catch(() => "dismissed");
    }
    await verifyWithServerUntilSettled();
  }, [verifyWithServerUntilSettled]);

  const resumeCheckout = useCallback(async () => {
    if (polling.current) return;
    setStatus("opening");
    const resumed = await paymentsService.initializeOrderPayment(orderId, `resume-${orderId}`).catch(() => null);
    const url = resumed ? paymentsService.hostedCheckoutUrlOf(resumed) : undefined;
    if (url) setAuthorizationUrl(url);
    await openCheckoutThenVerify(url);
  }, [openCheckoutThenVerify, orderId]);

  useEffect(() => {
    if (openedOnce.current) return;
    openedOnce.current = true;
    void openCheckoutThenVerify(authorizationUrl);
  }, [openCheckoutThenVerify, authorizationUrl]);

  const busy = status === "opening" || status === "checking" || status === "offline";
  const body =
    status === "failed"
      ? "The payment partner says this payment failed. If money left your account, it's returned automatically. You can try again or choose another way to pay."
      : status === "offline"
        ? "You're offline. We'll check your payment when you're back online."
        : status === "waiting"
          ? "The payment partner hasn't confirmed it yet. We'll update your order as soon as it does, and you won't be charged twice."
          : `${isNigeria === false ? ESCROW_NOTE_ELSEWHERE : ESCROW_NOTE_NIGERIA} We confirm every payment on our servers before your order goes ahead.`;
  return (
    <Screen>
      <Header title="Payment" />
      <View style={styles.body}>
        {busy ? <ActivityIndicator color={colors.primary} /> : <Shield24Icon color={status === "failed" ? colors.error : colors.primary} />}
        <Text size={16} weight={500} lineHeight={19.2} align="center" accessibilityRole="header">{headings[status]}</Text>
        <Text size={13} lineHeight={16.9} color={colors.textSubtle} align="center" accessibilityLiveRegion="polite">{body}</Text>
      </View>
      <View style={styles.footer}>
        <Button title={authorizationUrl ? "Open checkout again" : "Finish payment"} disabled={busy} onPress={() => void (authorizationUrl ? openCheckoutThenVerify(authorizationUrl) : resumeCheckout())} />
        <Button variant="subtle" title="Check payment" disabled={busy} onPress={verifyWithServerUntilSettled} />
        <Button variant="subtle" title="Get help with this payment" onPress={() => navigation.navigate("NewSupportTicket", { category: "payment", linkedReference: { kind: "payment", id: orderId, label: "Payment for this order" } })} />
        <Button variant="danger" title="View my orders" onPress={() => navigation.replace("Orders")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 40, alignItems: "center", justifyContent: "center", gap: 12 },
  footer: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
});
