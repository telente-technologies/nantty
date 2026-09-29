import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { paymentsService } from "@/services/payments.service";

type PaymentStatus = "waiting" | "checking" | "paid" | "failed";

export function PaymentScreen({ navigation, route }: MainScreenProps<"Payment">) {
  const { orderId, authorizationUrl } = route.params;
  const [status, setStatus] = useState<PaymentStatus>("waiting");
  const openedCheckout = useRef(false);

  const askServerToVerifyPayment = useCallback(async () => {
    setStatus("checking");
    try {
      const result = await paymentsService.verifyOrderPayment(orderId);
      if (result.status === "paid") {
        setStatus("paid");
        navigation.replace("OrderSuccess", { orderId });
      } else setStatus(result.status === "failed" ? "failed" : "waiting");
    } catch {
      setStatus("waiting");
    }
  }, [navigation, orderId]);

  const openHostedCheckout = useCallback(() => {
    if (!authorizationUrl) return;
    openedCheckout.current = true;
    Linking.openURL(authorizationUrl).catch(() => setStatus("failed"));
  }, [authorizationUrl]);

  useEffect(() => {
    openHostedCheckout();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && openedCheckout.current) askServerToVerifyPayment();
    });
    return () => subscription.remove();
  }, [openHostedCheckout, askServerToVerifyPayment]);

  return (
    <Screen>
      <Header title="Payment" paddingHorizontal={12} />
      <View style={styles.body}>
        {status === "checking" ? <ActivityIndicator color={colors.primary} /> : null}
        <Text size={16} weight={500} lineHeight={19.2} align="center" accessibilityRole="header">
          {status === "failed" ? "Payment didn't go through" : "Complete your payment"}
        </Text>
        <Text size={13} lineHeight={16.9} color={colors.textSubtle} align="center">
          {status === "failed"
            ? "No money was taken. You can try again or choose another method."
            : "Finish paying in the secure checkout page. When you're done, come back here and we'll confirm it with your bank."}
        </Text>
      </View>
      <View style={styles.footer}>
        <Button title="I've paid, check status" loading={status === "checking"} onPress={askServerToVerifyPayment} />
        <Button variant="subtle" title="Open checkout again" onPress={openHostedCheckout} disabled={!authorizationUrl} />
        <Button variant="danger" title="View my orders" onPress={() => navigation.replace("Orders")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 40, alignItems: "center", justifyContent: "center", gap: 12 },
  footer: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
});
