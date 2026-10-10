import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { CartGrandTotalCard } from "@/components/cart/cartGrandTotalCard";
import { CartSellerGroupCard } from "@/components/cart/cartSellerGroupCard";
import { PaymentModeChooser } from "@/components/cart/paymentModeChooser";
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
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { ordersService } from "@/services/commerce/orders.service";
import { paymentsService } from "@/services/commerce/payments.service";
import { trackProductInteraction } from "@/services/sellers/productInteractions.service";
import { useDeliveryAddressStore } from "@/store/deliveryAddress.store";
import type { PaymentChannel, SavedCardDisplay } from "@/types/commerce.type";
import type { PaymentMode } from "@/types";
import { directChoicesFor } from "@/utils/paymentMode.util";
import { readSavedCardDisplay, saveCardOnThisDevice, unlockSavedCardId } from "@/utils/savedCard.util";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

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
  const [paymentModes, setPaymentModes] = useState<Record<string, PaymentMode>>({});
  const choosePaymentMode = (storeId: string, mode: PaymentMode) => {
    checkoutKey.current = generateIdempotencyKey();
    setPaymentModes((current) => ({ ...current, [storeId]: mode }));
  };
  const addressId = chosenAddressId ?? addresses.data?.find((a) => a.isDefault)?.id ?? addresses.data?.[0]?.id ?? null;
  const cart = useMyCart(addressId);

  const placeOrderAndStartPayment = useMutation({
    mutationFn: async () => {
      const result = await ordersService.checkoutCartIntoOrders(addressId!, checkoutKey.current, directChoicesFor(cart.data?.groups ?? [], paymentModes));
      if (useSavedCard && savedCard) {
        const code = await unlockSavedCardId();
        if (!code) throw new Error("Saved card not unlocked");
        const charge = await paymentsService.chargeSavedCard(result.payableOrderId, code, `${checkoutKey.current}-saved`);
        if (charge.status !== "action_required") return { orderId: result.payableOrderId, authorizationUrl: undefined };
        return { orderId: result.payableOrderId, authorizationUrl: charge.authorizationUrl };
      }
      const newCard = saveNewCard ? await paymentsService.setUpCardOnThisDevice(`${checkoutKey.current}-card`).catch(() => null) : null;
      if (newCard) {
        await saveCardOnThisDevice(newCard).catch(() => undefined);
        const charge = await paymentsService.chargeSavedCard(result.payableOrderId, newCard.savedCardId, `${checkoutKey.current}-saved`);
        return { orderId: result.payableOrderId, authorizationUrl: charge.status === "action_required" ? charge.authorizationUrl : undefined };
      }
      const payment = await paymentsService.initializeOrderPayment(result.payableOrderId, "paystack", `${checkoutKey.current}-pay`);
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

  if (cart.isLoading || addresses.isLoading || (cart.isError && !cart.data)) {
    return (
      <Screen>
        <Header title="Checkout" paddingHorizontal={12} />
        {cart.isError ? <ErrorState message="Couldn't load your cart." onRetry={() => cart.refetch()} retrying={cart.isRefetching} /> : <ListSkeleton />}
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Checkout" paddingHorizontal={12} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text size={typeScale.md} weight={600} lineHeight={16.8} accessibilityRole="header">Shipping address</Text>
          {(addresses.data ?? []).map((address) => (
            <SelectableRow
              key={address.id}
              selected={address.id === addressId}
              onPress={() => chooseDeliveryAddress(address.id)}
              accessibilityLabel={`${address.fullName}, ${address.line1}, ${address.city}`}
            >
              <Text size={typeScale.md} weight={500} lineHeight={16.8}>{address.fullName}</Text>
              <Text size={typeScale.sm} lineHeight={16.9} color={colors.textMuted}>
                {formatAddressLocation(address)}
              </Text>
              <Text size={typeScale.sm} lineHeight={16.9} color={colors.textMuted}>{address.phone}</Text>
            </SelectableRow>
          ))}
          <Button variant="subtle" title="Add new address" onPress={() => navigation.navigate("AddressForm")} />
        </View>
        <View style={styles.section}>
          <Text size={typeScale.md} weight={600} lineHeight={16.8} accessibilityRole="header">Payment method</Text>
          {savedCard ? (
            <SelectableRow selected={useSavedCard} onPress={() => setUseSavedCard(true)} accessibilityLabel={`Saved ${savedCard.brand} card ending ${savedCard.last4}`}>
              <Text size={typeScale.md} weight={500} lineHeight={16.8}>{savedCard.brand} ending {savedCard.last4}</Text>
              <Text size={typeScale.sm} lineHeight={16.9} color={colors.textMuted}>Saved on this device. Confirmed with your fingerprint or face.</Text>
            </SelectableRow>
          ) : null}
          <SelectableRow selected={!useSavedCard} onPress={() => setUseSavedCard(false)} accessibilityLabel="Pay in the secure payment window">
            <Text size={typeScale.md} weight={500} lineHeight={16.8}>{savedCard ? "Another way to pay" : "Secure payment window"}</Text>
            <Text size={typeScale.sm} lineHeight={16.9} color={colors.textMuted}>
              {(channels.data?.channels ?? []).map((channel) => CHANNEL_LABELS[channel].name).join(", ") || "Card, bank transfer or USSD"}
            </Text>
          </SelectableRow>
          {!useSavedCard ? (
            <SelectableRow selected={saveNewCard} onPress={() => setSaveNewCard((value) => !value)} accessibilityLabel="Save this card on this device">
              <Text size={typeScale.sm} lineHeight={16.9}>Save my card on this device for next time</Text>
            </SelectableRow>
          ) : null}
        </View>
        {cart.data ? (
          <View style={styles.section}>
            <Text size={typeScale.md} weight={600} lineHeight={16.8} accessibilityRole="header">How to pay each seller</Text>
            {cart.data.groups.map((group) => (
              <PaymentModeChooser key={group.storeId} group={group} mode={paymentModes[group.storeId] ?? "escrow"} onChange={(mode) => choosePaymentMode(group.storeId, mode)} />
            ))}
          </View>
        ) : null}
        {cart.data ? (
          <View style={styles.section}>
            <Text size={typeScale.md} weight={600} lineHeight={16.8} accessibilityRole="header">Sellers and shipping</Text>
            {cart.data.groups.map((group) => (
              <CartSellerGroupCard key={group.storeId} group={group} showItems={false} />
            ))}
            <CartGrandTotalCard cart={cart.data} />
          </View>
        ) : null}
        <Text size={typeScale.xs} lineHeight={16.8} color={colors.textMuted}>
          Escrow orders are held until you confirm delivery. Direct orders pay the seller right away.
        </Text>
        <PurchaseTermsText />
      </ScrollView>
      <View style={styles.footer}>
        {placeOrderAndStartPayment.isError ? (
          <Text size={typeScale.xs} lineHeight={14.4} color={colors.error} align="center" accessibilityRole="alert">
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
  content: { paddingHorizontal: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[6], gap: spacing[6] },
  section: { gap: spacing[3] },
  footer: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[6], gap: spacing[2] },
});
