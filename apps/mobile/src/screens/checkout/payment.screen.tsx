import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Shield24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { paymentsService } from "@/services/payments.service";
import { saveCardOnThisDevice } from "@/utils/savedCard.util";

type PaymentStatus = "opening" | "checking" | "waiting" | "failed";

const VERIFY_ATTEMPTS_AFTER_RETURN = 4;
const DELAY_BETWEEN_VERIFY_ATTEMPTS_MS = 1500;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function PaymentScreen({ navigation, route }: MainScreenProps<"Payment">) {
  const { colors } = useTheme();
  const { orderId, authorizationUrl } = route.params;
  const [status, setStatus] = useState<PaymentStatus>("opening");
  const openedOnce = useRef(false);

  const verifyWithServerUntilSettled = useCallback(async () => {
    setStatus("checking");
    for (let attempt = 0; attempt < VERIFY_ATTEMPTS_AFTER_RETURN; attempt++) {
      try {
        const result = await paymentsService.verifyOrderPayment(orderId);
        if (result.status === "paid") {
          if (result.savedCard) await saveCardOnThisDevice(result.savedCard).catch(() => undefined);
          navigation.replace("OrderSuccess", { orderId });
          return;
        }
        if (result.status === "failed") {
          setStatus("failed");
          return;
        }
      } catch {
        break;
      }
      await wait(DELAY_BETWEEN_VERIFY_ATTEMPTS_MS);
    }
    setStatus("waiting");
  }, [navigation, orderId]);

  const openCheckoutThenVerify = useCallback(async () => {
    if (!authorizationUrl) {
      await verifyWithServerUntilSettled();
      return;
    }
    setStatus("opening");
    await paymentsService.openHostedCheckoutInAppBrowser(authorizationUrl).catch(() => "dismissed");
    await verifyWithServerUntilSettled();
  }, [authorizationUrl, verifyWithServerUntilSettled]);

  useEffect(() => {
    if (openedOnce.current) return;
    openedOnce.current = true;
    openCheckoutThenVerify();
  }, [openCheckoutThenVerify]);

  const busy = status === "opening" || status === "checking";
  return (
    <Screen>
      <Header title="Payment" />
      <View style={styles.body}>
        {busy ? <ActivityIndicator color={colors.primary} /> : <Shield24Icon color={status === "failed" ? colors.error : colors.primary} />}
        <Text size={16} weight={500} lineHeight={19.2} align="center" accessibilityRole="header">
          {status === "failed" ? "Payment didn't go through" : status === "checking" ? "Confirming payment…" : status === "opening" ? "Opening secure payment…" : "Waiting for your payment"}
        </Text>
        <Text size={13} lineHeight={16.9} color={colors.textSubtle} align="center">
          {status === "failed"
            ? "No money was taken. You can try again or choose another method."
            : "Your money goes into Zudomart escrow, not to the seller. We confirm every payment on our servers before your order is placed."}
        </Text>
      </View>
      <View style={styles.footer}>
        <Button title="Open checkout again" disabled={busy || !authorizationUrl} onPress={openCheckoutThenVerify} />
        <Button variant="subtle" title="I've paid, check status" disabled={busy} onPress={verifyWithServerUntilSettled} />
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
