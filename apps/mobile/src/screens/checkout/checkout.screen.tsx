import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { OrderSummaryCard } from "@/components/cart/orderSummaryCard";
import { PurchaseTermsText } from "@/components/cart/purchaseTermsText";
import { SelectableRow } from "@/components/cart/selectableRow";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { useMyCart } from "@/hooks/useCart.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { ordersService } from "@/services/orders.service";
import { paymentsService } from "@/services/payments.service";
import type { PaymentProvider } from "@/types/commerce.type";

const PROVIDERS: { id: PaymentProvider; name: string; note: string }[] = [
  { id: "paystack", name: "Paystack", note: "Card, bank transfer or USSD" },
  { id: "flutterwave", name: "Flutterwave", note: "Card, bank transfer or mobile money" },
];

export function CheckoutScreen({ navigation }: MainScreenProps<"Checkout">) {
  const cart = useMyCart();
  const addresses = useQuery({ queryKey: ["addresses"], queryFn: ordersService.fetchMyShippingAddresses });
  const [chosenAddressId, setChosenAddressId] = useState<string | null>(null);
  const [provider, setProvider] = useState<PaymentProvider>("paystack");
  const checkoutKey = useRef(generateIdempotencyKey());
  const addressId = chosenAddressId ?? addresses.data?.find((a) => a.isDefault)?.id ?? addresses.data?.[0]?.id ?? null;

  const placeOrderAndStartPayment = useMutation({
    mutationFn: async () => {
      const result = await ordersService.checkoutCartIntoOrders(addressId!, checkoutKey.current);
      const payment = await paymentsService.initializeOrderPayment(result.payableOrderId, provider, `${checkoutKey.current}-pay`);
      return payment;
    },
    onSuccess: (payment) => navigation.replace("Payment", { orderId: payment.orderId, authorizationUrl: payment.authorizationUrl }),
  });

  if (cart.isLoading || addresses.isLoading) {
    return (
      <Screen>
        <Header title="Checkout" paddingHorizontal={12} />
        <ActivityIndicator style={styles.state} color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Checkout" paddingHorizontal={12} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text size={14} weight={600} lineHeight={16.8} accessibilityRole="header">Shipping address</Text>
          {(addresses.data ?? []).map((address) => (
            <SelectableRow
              key={address.id}
              selected={address.id === addressId}
              onPress={() => setChosenAddressId(address.id)}
              accessibilityLabel={`${address.fullName}, ${address.line1}, ${address.city}`}
            >
              <Text size={14} weight={500} lineHeight={16.8}>{address.fullName}</Text>
              <Text size={13} lineHeight={16.9} color={colors.textMuted}>
                {address.line1}, {address.city}, {address.state}
              </Text>
              <Text size={13} lineHeight={16.9} color={colors.textMuted}>{address.phone}</Text>
            </SelectableRow>
          ))}
          <Button variant="subtle" title="Add new address" onPress={() => navigation.navigate("AddressForm")} />
        </View>
        <View style={styles.section}>
          <Text size={14} weight={600} lineHeight={16.8} accessibilityRole="header">Payment method</Text>
          {PROVIDERS.map((option) => (
            <SelectableRow key={option.id} selected={provider === option.id} onPress={() => setProvider(option.id)} accessibilityLabel={option.name}>
              <Text size={14} weight={500} lineHeight={16.8}>{option.name}</Text>
              <Text size={13} lineHeight={16.9} color={colors.textMuted}>{option.note}</Text>
            </SelectableRow>
          ))}
        </View>
        {cart.data ? (
          <OrderSummaryCard itemsTotal={cart.data.itemsTotal} shopDiscount={cart.data.shopDiscount} shipping={cart.data.shipping} total={cart.data.total} />
        ) : null}
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>
          Your payment is held safely in escrow and only released to the seller after you confirm delivery.
        </Text>
        <PurchaseTermsText />
      </ScrollView>
      <View style={styles.footer}>
        {placeOrderAndStartPayment.isError ? (
          <Text size={12} lineHeight={14.4} color={colors.error} align="center" accessibilityRole="alert">
            Couldn't place your order. Please try again.
          </Text>
        ) : null}
        <Button
          title="Place order and pay"
          disabled={!addressId || !cart.data || cart.data.items.length === 0}
          loading={placeOrderAndStartPayment.isPending}
          onPress={() => placeOrderAndStartPayment.mutate()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: { marginTop: 64 },
  content: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 24, gap: 24 },
  section: { gap: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 8 },
});
