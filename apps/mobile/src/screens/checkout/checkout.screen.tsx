import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { CartGrandTotalCard } from "@/components/cart/cartGrandTotalCard";
import { CartSellerGroupCard } from "@/components/cart/cartSellerGroupCard";
import { PurchaseTermsText } from "@/components/cart/purchaseTermsText";
import { formatAddressLocation } from "@/components/settings/addressRow";
import { SelectableRow } from "@/components/cart/selectableRow";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { cartQueryKey, useMyCart } from "@/hooks/useCart.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { ordersService } from "@/services/orders.service";
import { paymentsService } from "@/services/payments.service";
import { trackProductInteraction } from "@/services/productInteractions.service";
import { useDeliveryAddressStore } from "@/store/deliveryAddress.store";
import type { PaymentChannel, SavedCardDisplay } from "@/types/commerce.type";
import { readSavedCardDisplay, unlockSavedCardAuthorizationCode } from "@/utils/savedCard.util";
import { ListSkeleton } from "@/components/ui/listSkeleton";

const CHANNEL_LABELS: Record<PaymentChannel, { name: string; note: string }> = {
  card: { name: "Card", note: "Debit or credit card" },
  bank_transfer: { name: "Bank transfer", note: "Pay from your bank app" },
  ussd: { name: "USSD", note: "Pay with a code from your phone" },
};

export function CheckoutScreen({ navigation }: MainScreenProps<"Checkout">) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const addresses = useQuery({ queryKey: ["addresses"], queryFn: ordersService.fetchMyShippingAddresses });
  const { chosenAddressId, chooseDeliveryAddress } = useDeliveryAddressStore();
  const channels = useQuery({ queryKey: ["payments", "channels"], queryFn: paymentsService.fetchPaymentChannels });
  const [savedCard, setSavedCard] = useState<SavedCardDisplay | null>(null);
  const [useSavedCard, setUseSavedCard] = useState(false);
  const [saveNewCard, setSaveNewCard] = useState(false);
  useEffect(() => {
    void readSavedCardDisplay().then((card) => {
      setSavedCard(card);
      setUseSavedCard(card !== null);
    });
  }, []);
  const checkoutKey = useRef(generateIdempotencyKey());
  const addressId = chosenAddressId ?? addresses.data?.find((a) => a.isDefault)?.id ?? addresses.data?.[0]?.id ?? null;
  const cart = useMyCart(addressId);

  const placeOrderAndStartPayment = useMutation({
    mutationFn: async () => {
      const result = await ordersService.checkoutCartIntoOrders(addressId!, checkoutKey.current);
      if (useSavedCard && savedCard) {
        const code = await unlockSavedCardAuthorizationCode();
        if (!code) throw new Error("Saved card not unlocked");
        const charge = await paymentsService.chargeSavedCard(result.payableOrderId, code, `${checkoutKey.current}-saved`);
        if (charge.status !== "action_required") return { orderId: result.payableOrderId, authorizationUrl: undefined };
        return { orderId: result.payableOrderId, authorizationUrl: charge.authorizationUrl };
      }
      const payment = await paymentsService.initializeOrderPayment(result.payableOrderId, "paystack", saveNewCard, `${checkoutKey.current}-pay`);
      return { orderId: payment.orderId, authorizationUrl: payment.authorizationUrl };
    },
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: cartQueryKey });
      cart.data?.groups
        .filter((group) => group.shipping.status === "calculated")
        .flatMap((group) => group.items)
        .forEach((item) => void trackProductInteraction("product.purchased", { productId: item.product.id, quantity: item.quantity }));
      navigation.replace("Payment", { orderId: payment.orderId, authorizationUrl: payment.authorizationUrl });
    },
  });

  if (cart.isLoading || addresses.isLoading) {
    return (
      <Screen>
        <Header title="Checkout" paddingHorizontal={12} />
        <ListSkeleton />
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
              onPress={() => chooseDeliveryAddress(address.id)}
              accessibilityLabel={`${address.fullName}, ${address.line1}, ${address.city}`}
            >
              <Text size={14} weight={500} lineHeight={16.8}>{address.fullName}</Text>
              <Text size={13} lineHeight={16.9} color={colors.textMuted}>
                {formatAddressLocation(address)}
              </Text>
              <Text size={13} lineHeight={16.9} color={colors.textMuted}>{address.phone}</Text>
            </SelectableRow>
          ))}
          <Button variant="subtle" title="Add new address" onPress={() => navigation.navigate("AddressForm")} />
        </View>
        <View style={styles.section}>
          <Text size={14} weight={600} lineHeight={16.8} accessibilityRole="header">Payment method</Text>
          {savedCard ? (
            <SelectableRow selected={useSavedCard} onPress={() => setUseSavedCard(true)} accessibilityLabel={`Saved ${savedCard.brand} card ending ${savedCard.last4}`}>
              <Text size={14} weight={500} lineHeight={16.8}>{savedCard.brand} ending {savedCard.last4}</Text>
              <Text size={13} lineHeight={16.9} color={colors.textMuted}>Saved on this device. Confirmed with your fingerprint or face.</Text>
            </SelectableRow>
          ) : null}
          <SelectableRow selected={!useSavedCard} onPress={() => setUseSavedCard(false)} accessibilityLabel="Pay in the secure payment window">
            <Text size={14} weight={500} lineHeight={16.8}>{savedCard ? "Another way to pay" : "Secure payment window"}</Text>
            <Text size={13} lineHeight={16.9} color={colors.textMuted}>
              {(channels.data?.channels ?? []).map((channel) => CHANNEL_LABELS[channel].name).join(", ") || "Card, bank transfer or USSD"}
            </Text>
          </SelectableRow>
          {!useSavedCard ? (
            <SelectableRow selected={saveNewCard} onPress={() => setSaveNewCard((value) => !value)} accessibilityLabel="Save this card on this device">
              <Text size={13} lineHeight={16.9}>Save my card on this device for next time</Text>
            </SelectableRow>
          ) : null}
        </View>
        {cart.data ? (
          <View style={styles.section}>
            <Text size={14} weight={600} lineHeight={16.8} accessibilityRole="header">Sellers and shipping</Text>
            {cart.data.groups.map((group) => (
              <CartSellerGroupCard key={group.storeId} group={group} showItems={false} />
            ))}
            <CartGrandTotalCard cart={cart.data} />
          </View>
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
          disabled={!addressId || !cart.data || cart.data.payableGroupCount === 0}
          loading={placeOrderAndStartPayment.isPending}
          onPress={() => placeOrderAndStartPayment.mutate()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 24, gap: 24 },
  section: { gap: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 8 },
});
