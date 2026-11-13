import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { CartGrandTotalCard } from "@/components/cart/cartGrandTotalCard";
import { CartSellerGroupCard } from "@/components/cart/cartSellerGroupCard";
import { PaymentModeChooser } from "@/components/cart/paymentModeChooser";
import { PurchaseTermsText } from "@/components/cart/purchaseTermsText";
import { formatAddressLocation } from "@/components/settings/addressRow";
import { SelectableRow } from "@/components/cart/selectableRow";
import { Button } from "@/components/ui/button";
import { KeyboardAwareForm } from "@/components/ui/keyboardAwareForm";
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
import { CountryRequiredPicker, isCountryRequiredError } from "@/components/checkout/countryRequiredPicker";
import { useProviderWallet, providerWalletQueryKeys } from "@/components/wallet/providerWalletQueries.hook";
import { providerWalletService } from "@/services/money/providerWallet.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { describePaymentProblem, presentPaymentProblem } from "@/utils/paymentProblem.util";
import { checkoutEscrowNote } from "@/utils/paymentCopy.util";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";
import { isCheckoutShippingQuoteReady } from "@/utils/checkoutShippingQuote.util";
import { ApiError } from "@/errors/api.error";
import { requireVerifiedCheckoutEmail } from "@/utils/requireVerifiedCheckoutEmail.util";

const isHandledProblem = (error: unknown) => describePaymentProblem(error) !== null;

const CHANNEL_LABELS: Record<PaymentChannel, { name: string; note: string }> = {
  card: { name: "Card", note: "Debit or credit card" },
  bank: { name: "Bank", note: "Pay through your bank" },
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
  const [payFromWallet, setPayFromWallet] = useState(false);
  const inFlight = useRef(false);
  const providerWallet = useProviderWallet();
  const [countryNeeded, setCountryNeeded] = useState(false);
  const [quoteChanged, setQuoteChanged] = useState(false);
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
  const shippingQuoteReady = isCheckoutShippingQuoteReady({
    selectedAddressId: addressId,
    quoteAddressId: cart.data?.addressId,
    shippingQuoteRevision: cart.data?.shippingQuoteRevision,
    hasQuote: Boolean(cart.data),
    isFetching: cart.isFetching,
    isPlaceholderData: cart.isPlaceholderData,
    isError: cart.isError,
  });
  const deliverableGroupCount = cart.data?.groups.filter((group) => group.shipping.status === "calculated").length ?? 0;
  const blockedGroupCount = cart.data?.groups.filter((group) => group.shipping.status === "notDeliverable").length ?? 0;
  const unavailableItemCount = cart.data?.unavailableItemCount ?? cart.data?.unavailableItems?.length ?? 0;
  const payableGroups = cart.data?.groups.filter((group) => group.shipping.status === "calculated") ?? [];
  const totalMinor = shippingQuoteReady ? (cart.data?.total.amountMinor ?? 0) : 0;
  const walletCovers = shippingQuoteReady && !!providerWallet.active && totalMinor > 0 && providerWallet.spendableMinor >= totalMinor;
  const usingWallet = payFromWallet && walletCovers;

  const placeOrderAndStartPayment = useMutation({
    mutationFn: async () => {
      // Payment requires a verified account email. Check it before checkout
      // creates order groups and consumes the cart.
      await requireVerifiedCheckoutEmail();
      const revision = cart.data?.shippingQuoteRevision;
      if (!revision) throw new Error("Refresh delivery details before placing your order.");
      const result = await ordersService.checkoutCartIntoOrders(addressId!, revision, checkoutKey.current, directChoicesFor(cart.data?.groups ?? [], paymentModes));
      if (usingWallet) {
        const payment = await paymentsService.initializeOrderPayment(result.payableOrderId, `${checkoutKey.current}-pay`);
        await providerWalletService.payFromWallet(payment.reference, `${checkoutKey.current}-wallet`);
        return { orderId: payment.orderId, authorizationUrl: undefined };
      }
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
      const payment = await paymentsService.initializeOrderPayment(result.payableOrderId, `${checkoutKey.current}-pay`);
      return { orderId: payment.orderId, authorizationUrl: paymentsService.hostedCheckoutUrlOf(payment) };
    },
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: cartQueryKey });
      queryClient.invalidateQueries({ queryKey: providerWalletQueryKeys.wallet });
      cart.data?.groups
        .filter((group) => group.shipping.status === "calculated")
        .flatMap((group) => group.items)
        .forEach((item) => void trackProductInteraction("product.purchased", { productId: item.product.id, quantity: item.quantity }));
      navigation.replace("Payment", { orderId: payment.orderId, authorizationUrl: payment.authorizationUrl });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "VERIFY_EMAIL_REQUIRED") {
        navigation.navigate("EmailVerification");
        return;
      }
      if (error instanceof ApiError && error.code === "CART_CHANGED") {
        checkoutKey.current = generateIdempotencyKey();
        setPayFromWallet(false);
        setQuoteChanged(true);
        void cart.refetch();
        return;
      }
      const needsCountry = isCountryRequiredError(error);
      setCountryNeeded(needsCountry);
      if (needsCountry) return;
      presentPaymentProblem(error, {
        onVerify: () => navigation.navigate("PayoutSetup"),
        onPayByCard: () => {
          setPayFromWallet(false);
          checkoutKey.current = generateIdempotencyKey();
        },
      });
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  const startPayment = () => {
    if (inFlight.current || placeOrderAndStartPayment.isPending) return;
    inFlight.current = true;
    placeOrderAndStartPayment.mutate();
  };

  if (cart.isLoading || addresses.isLoading || (cart.isError && !cart.data)) {
    return (
      <Screen>
        <Header title="Checkout" paddingHorizontal={12} />
        {cart.isError ? <ErrorState error={cart.error} message="Couldn't load your cart." onRetry={() => cart.refetch()} retrying={cart.isRefetching} /> : <ListSkeleton />}
      </Screen>
    );
  }

  if (cart.data && cart.data.items.length === 0 && (cart.data.unavailableItemCount ?? cart.data.unavailableItems?.length ?? 0) > 0) {
    return (
      <Screen>
        <Header title="Checkout" paddingHorizontal={12} />
        <View style={styles.unavailableOnly}>
          <Text size={15} weight={600} lineHeight={20} accessibilityRole="header">Your cart needs attention</Text>
          <Text size={13} lineHeight={19} color={colors.textMuted}>Remove unavailable products from your cart before checkout.</Text>
          <Button variant="subtle" title="Review your cart" onPress={() => navigation.navigate("Cart")} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Checkout" paddingHorizontal={12} />
      <KeyboardAwareForm
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        footerStyle={styles.footer}
        footer={
          <>
            {placeOrderAndStartPayment.isError && !countryNeeded && !isHandledProblem(placeOrderAndStartPayment.error) ? (
              <Text size={typeScale.xs} lineHeight={14.4} color={colors.error} align="center" accessibilityRole="alert">
                Couldn&apos;t place your order. Please try again.
              </Text>
            ) : null}
            <Button
              title={usingWallet ? "Pay from wallet" : "Pay securely"}
              disabled={!addressId || !shippingQuoteReady || !cart.data || cart.data.payableGroupCount === 0 || unavailableItemCount > 0}
              loading={placeOrderAndStartPayment.isPending}
              onPress={startPayment}
            />
          </>
        }
      >
        {countryNeeded ? (
          <CountryRequiredPicker
            onSaved={() => {
              setCountryNeeded(false);
              checkoutKey.current = generateIdempotencyKey();
              startPayment();
            }}
          />
        ) : null}
        <View style={styles.section}>
          <Text size={typeScale.md} weight={600} lineHeight={16.8} accessibilityRole="header">Shipping address</Text>
          {quoteChanged ? (
            <Text size={typeScale.sm} lineHeight={19} color={colors.textMuted} accessibilityRole="status">
              Your cart or delivery details changed. We refreshed the quote; review the updated total before placing your order.
            </Text>
          ) : null}
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
          {!addressId ? (
            <Text size={typeScale.sm} lineHeight={19} color={colors.textMuted} accessibilityRole="status">
              Choose an address to calculate delivery and your order total.
            </Text>
          ) : null}
          {addresses.isError ? (
            <ErrorState
              error={addresses.error}
              compact
              message={addresses.data?.length ? "Your saved addresses may be out of date." : "Couldn't load your saved addresses."}
              onRetry={() => addresses.refetch()}
              retrying={addresses.isRefetching}
            />
          ) : null}
          {addressId && cart.isError ? (
            <View accessibilityRole="alert">
              <Text size={typeScale.sm} lineHeight={19} color={colors.error}>
                We couldn’t calculate delivery for this address. Try again before placing your order.
              </Text>
              <Button variant="subtle" title={cart.isRefetching ? "Retrying delivery quote…" : "Retry delivery quote"} disabled={cart.isRefetching} onPress={() => { void cart.refetch(); }} />
            </View>
          ) : null}
          {addressId && cart.isFetching && !cart.isError ? (
            <Text size={typeScale.sm} lineHeight={19} color={colors.textMuted} accessibilityRole="status">
              Calculating delivery for this address…
            </Text>
          ) : null}
          {addressId && cart.data && !cart.data.shippingQuoteRevision ? (
            <Text size={typeScale.sm} lineHeight={19} color={colors.error} accessibilityRole="alert">
              We couldn’t verify this delivery quote. Refresh delivery details before placing your order.
            </Text>
          ) : null}
          {shippingQuoteReady && unavailableItemCount > 0 ? (
            <View accessibilityRole="alert">
              <Text size={typeScale.sm} lineHeight={19} color={colors.error}>
                {unavailableItemCount} {unavailableItemCount === 1 ? "product is" : "products are"} unavailable. Remove {unavailableItemCount === 1 ? "it" : "them"} from your cart before checkout.
              </Text>
              <Button variant="subtle" title="Return to cart" onPress={() => navigation.navigate("Cart")} />
            </View>
          ) : null}
        </View>
        <View style={styles.section}>
          <Text size={typeScale.md} weight={600} lineHeight={16.8} accessibilityRole="header">Payment method</Text>
          {walletCovers && providerWallet.active ? (
            <SelectableRow selected={usingWallet} onPress={() => setPayFromWallet(true)} accessibilityLabel="Pay from your wallet">
              <Text size={typeScale.md} weight={500} lineHeight={16.8}>Pay from wallet</Text>
              <Text size={typeScale.sm} lineHeight={16.9} color={colors.textMuted}>
                {formatMoneyForDisplay({ amountMinor: providerWallet.spendableMinor, currency: cart.data!.total.currency })} available. The payment stays locked in your wallet until delivery.
              </Text>
            </SelectableRow>
          ) : null}
          {savedCard ? (
            <SelectableRow selected={useSavedCard && !usingWallet} onPress={() => { setPayFromWallet(false); setUseSavedCard(true); }} accessibilityLabel={`Saved ${savedCard.brand} card ending ${savedCard.last4}`}>
              <Text size={typeScale.md} weight={500} lineHeight={16.8}>{savedCard.brand} ending {savedCard.last4}</Text>
              <Text size={typeScale.sm} lineHeight={16.9} color={colors.textMuted}>Saved on this device. Confirmed with your fingerprint or face.</Text>
            </SelectableRow>
          ) : null}
          <SelectableRow selected={!useSavedCard && !usingWallet} onPress={() => { setPayFromWallet(false); setUseSavedCard(false); }} accessibilityLabel="Pay in the secure payment window">
            <Text size={typeScale.md} weight={500} lineHeight={16.8}>{savedCard ? "Another way to pay" : "Secure payment window"}</Text>
            <Text size={typeScale.sm} lineHeight={16.9} color={colors.textMuted}>
              {(channels.data?.channels ?? []).map((channel) => CHANNEL_LABELS[channel]?.name).filter((name): name is string => !!name).join(", ") || "Card, bank transfer or USSD"}
            </Text>
          </SelectableRow>
          {!useSavedCard && !usingWallet ? (
            <SelectableRow selected={saveNewCard} onPress={() => setSaveNewCard((value) => !value)} accessibilityLabel="Save this card on this device">
              <Text size={typeScale.sm} lineHeight={16.9}>Save my card on this device for next time</Text>
            </SelectableRow>
          ) : null}
        </View>
        {cart.data ? (
          <View style={styles.section}>
            <Text size={typeScale.md} weight={600} lineHeight={16.8} accessibilityRole="header">How to pay each seller</Text>
            {payableGroups.map((group) => (
              <PaymentModeChooser key={group.storeId} group={group} mode={paymentModes[group.storeId] ?? "escrow"} onChange={(mode) => choosePaymentMode(group.storeId, mode)} />
            ))}
          </View>
        ) : null}
        {cart.data ? (
          <View style={styles.section}>
            <Text size={typeScale.md} weight={600} lineHeight={16.8} accessibilityRole="header">Sellers and shipping</Text>
            {shippingQuoteReady && blockedGroupCount > 0 && deliverableGroupCount > 0 ? (
              <Text size={typeScale.sm} lineHeight={19} color={colors.textMuted} accessibilityRole="alert">
                Some sellers can’t deliver to this address. Those items will stay in your cart while the deliverable items are checked out.
              </Text>
            ) : null}
            {shippingQuoteReady && blockedGroupCount > 0 && deliverableGroupCount === 0 ? (
              <Text size={typeScale.sm} lineHeight={19} color={colors.error} accessibilityRole="alert">
                None of these sellers can deliver to this address. Choose another address or update your cart to continue.
              </Text>
            ) : null}
            {cart.data.groups.map((group) => (
              <CartSellerGroupCard key={group.storeId} group={group} showItems={false} shippingQuoteReady={shippingQuoteReady} />
            ))}
            <CartGrandTotalCard cart={cart.data} shippingQuoteReady={shippingQuoteReady} />
          </View>
        ) : null}
        <Text size={typeScale.xs} lineHeight={16.8} color={colors.textMuted}>
          {checkoutEscrowNote(providerWallet.isNigeria)}
        </Text>
        <PurchaseTermsText />
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[6], gap: spacing[6] },
  section: { gap: spacing[3] },
  footer: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[3], gap: spacing[2] },
  unavailableOnly: { flex: 1, justifyContent: "center", paddingHorizontal: spacing[4], gap: spacing[3] },
});
