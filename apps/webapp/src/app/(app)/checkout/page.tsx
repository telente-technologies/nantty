"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { AddressEditorDialog, addressesQueryKey } from "@/components/address/addressBook";
import { formatAddressLocation } from "@/components/address/addressForm.util";
import { useShippingQuote } from "@/components/address/shippingQuote.hook";
import { PaymentModeChooser } from "@/components/commerce/paymentModeChooser";
import { SellerGroupedSummary } from "@/components/commerce/sellerGroupedSummary";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { MapPinIcon } from "@/components/ui/icons";
import { cartsService } from "@/services/carts.service";
import { createIdempotencyKey, readErrorMessageForDisplay, WebappRequestError } from "@/services/clientApi.service";
import { CountryRequiredPicker, countryRequiredCode } from "@/components/commerce/countryRequiredPicker";
import { ordersService } from "@/services/orders.service";
import { emailVerificationService } from "@/services/webActions.service";
import { useMutation, useQuery } from "@tanstack/react-query";
import { describeErrorSignal, readErrorSignal } from "@nantty/web-kit";
import { CheckoutPaymentChoice, canPayFromWallet, type CheckoutPaymentSource } from "@/components/commerce/checkoutPaymentChoice";
import { providerWalletQueryKeys, providerWalletService } from "@/services/providerWallet.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { paymentsService } from "@/services/payments.service";
import type { PaymentMode } from "@/types";
import { groupCartItemsByStore } from "@/utils/groupCartItemsByStore.util";
import { isCheckoutShippingQuoteReady } from "@/utils/checkoutShippingQuote.util";
import { isDirectPaymentStore } from "@/utils/paymentMode.util";
import { openHostedCheckout } from "@/utils/hostedCheckout.util";
import { forgetPendingValue, pendingSubscriptionStorageKey, rememberPendingOrderPayment } from "@/utils/paymentReturn.util";
import { presentPaymentProblem } from "@/utils/paymentProblem.util";

import styles from "./page.module.css";

export default function CheckoutPage() {
  const router = useRouter();
  const accountEmailQuery = useQuery({ queryKey: ["account", "email"], queryFn: emailVerificationService.fetchAccountEmailStatus, retry: false });
  const cartQuery = useQuery({ queryKey: ["cart"], queryFn: cartsService.fetchMyCart, retry: false });
  const addressesQuery = useQuery({ queryKey: addressesQueryKey, queryFn: ordersService.fetchMyShippingAddresses, retry: false });

  const [chosenAddressId, setChosenAddressId] = useState<string | null>(null);
  const channelsQuery = useQuery({ queryKey: ["payments", "channels"], queryFn: paymentsService.fetchPaymentChannels, retry: false });
  const walletQuery = useQuery({ queryKey: providerWalletQueryKeys.wallet, queryFn: providerWalletService.fetchMyWallet, retry: false });
  const verificationQuery = useQuery({ queryKey: providerWalletQueryKeys.verification, queryFn: providerWalletService.fetchMyVerificationLevel, retry: false });
  const [paymentSource, setPaymentSource] = useState<CheckoutPaymentSource>("hosted");
  const [error, setError] = useState<string | null>(null);
  const [checkoutProblem, setCheckoutProblem] = useState<unknown>(null);
  const [isCountryNeeded, setCountryNeeded] = useState(false);
  const checkoutKey = useRef(createIdempotencyKey("checkout"));
  const placeOrderInFlight = useRef(false);
  const [paymentModes, setPaymentModes] = useState<Record<string, PaymentMode>>({});
  const choosePaymentMode = (storeId: string, mode: PaymentMode) => {
    checkoutKey.current = createIdempotencyKey("checkout");
    setPaymentModes((current) => ({ ...current, [storeId]: mode }));
  };

  const addressId = chosenAddressId ?? addressesQuery.data?.find((address) => address.isDefault)?.id ?? addressesQuery.data?.[0]?.id ?? null;

  const [isAddingAddress, setAddingAddress] = useState(false);
  const quoteQuery = useShippingQuote(addressId);
  const quote = quoteQuery.data ?? null;
  const quoteReady = isCheckoutShippingQuoteReady({
    selectedAddressId: addressId,
    quote,
    isFetching: quoteQuery.isFetching,
    isError: quoteQuery.isError,
  });
  const currentQuote = quoteReady ? quote : null;
  const deliverableGroupCount = currentQuote?.groups.filter((group) => group.status === "calculated").length ?? 0;
  const blockedGroupCount = currentQuote?.groups.filter((group) => group.status === "notDeliverable").length ?? 0;
  const unavailableItemCount = Math.max(currentQuote?.unavailableItemCount ?? 0, cartQuery.data?.unavailableItemCount ?? cartQuery.data?.unavailableItems?.length ?? 0);
  const hasShippableGroup = deliverableGroupCount > 0;
  const deliverableStoreIds = new Set(currentQuote?.groups.filter((group) => group.status === "calculated").map((group) => group.storeId) ?? []);
  const checkoutItems = currentQuote
    ? (cartQuery.data?.items ?? []).filter((item) => deliverableStoreIds.has(item.store?.id ?? ""))
    : cartQuery.data?.items ?? [];
  const checkoutStoreGroups = groupCartItemsByStore(cartQuery.data?.items ?? []).filter((group) => deliverableStoreIds.has(group.storeId));

  const orderTotal = currentQuote?.total ?? null;
  const walletChosen = paymentSource === "wallet" && canPayFromWallet(walletQuery.data, orderTotal);
  const isNigeria = (verificationQuery.data?.country ?? "NG") === "NG";
  const placeOrder = useMutation({
    mutationFn: async () => {
      const emailStatus = await accountEmailQuery.refetch();
      if (emailStatus.isError) throw emailStatus.error;
      if (emailStatus.data?.emailVerified !== true) {
        throw new WebappRequestError(403, "VERIFY_EMAIL_REQUIRED", "Verify your email to continue.");
      }
      if (!addressId) throw new Error("Choose a shipping address first.");
      if (!currentQuote?.shippingQuoteRevision) throw new Error("Refresh delivery details before placing your order.");
      const directChoices = Object.fromEntries(
        groupCartItemsByStore(cartQuery.data?.items ?? [])
          .filter((group) => isDirectPaymentStore(group.store))
          .map((group) => [group.storeId, paymentModes[group.storeId] ?? "escrow"] as const),
      );
      const result = await ordersService.checkoutCartIntoOrders(addressId, currentQuote.shippingQuoteRevision, checkoutKey.current, directChoices);
      const payment = await paymentsService.initializeOrderPayment(result.payableOrderId, `${checkoutKey.current}-pay`);
      forgetPendingValue(pendingSubscriptionStorageKey);
      rememberPendingOrderPayment({ orderId: payment.orderId, reference: payment.reference, checkoutUrl: payment.checkoutUrl || payment.authorizationUrl });
      if (walletChosen) await providerWalletService.payFromWallet(payment.reference, `${checkoutKey.current}-wallet`);
      return { payment, paidFromWallet: walletChosen };
    },
    onSuccess: ({ payment, paidFromWallet }) => {
      if (paidFromWallet) {
        router.push("/pay/return");
        return;
      }
      if (openHostedCheckout(payment) === "blocked") {
        setError("We couldn't open the secure payment page. Your order is saved; open it from your orders to pay.");
        router.push(`/orders/${encodeURIComponent(payment.orderId)}`);
      }
    },
    onError: async (caught) => {
      if (caught instanceof WebappRequestError && caught.code === "VERIFY_EMAIL_REQUIRED") {
        setError(null);
        router.push("/verify-email?next=/checkout");
        return;
      }
      if (caught instanceof WebappRequestError && caught.code === countryRequiredCode) {
        setError(null);
        setCountryNeeded(true);
        return;
      }
      if (await presentPaymentProblem(caught, (href) => router.push(href))) {
        setError(null);
        return;
      }
      const problemKind = describeErrorSignal(readErrorSignal(caught)).kind;
      if (problemKind === "cartChanged" || problemKind === "checkoutExpired") {
        if (problemKind === "cartChanged") {
          checkoutKey.current = createIdempotencyKey("checkout");
          setCheckoutProblem(null);
          setError("Your cart or delivery details changed. We refreshed the quote; review the updated total before placing your order.");
          void quoteQuery.refetch();
          void cartQuery.refetch();
          return;
        }
        setError(null);
        setCheckoutProblem(caught);
        void cartQuery.refetch();
        return;
      }
      setError(readErrorMessageForDisplay(caught));
    },
  });

  if (cartQuery.isLoading || addressesQuery.isLoading) {
    return (
      <div className={styles.page} role="status" aria-label="Preparing checkout">
        <Skeleton width={160} height={32} />
        <div className={styles.layout}>
          <Skeleton height={360} />
          <Skeleton height={300} />
        </div>
      </div>
    );
  }
  if (cartQuery.isError) return <ErrorState description="We couldn't load your cart." error={cartQuery.error} onRetry={() => void cartQuery.refetch()} />;

  const cart = cartQuery.data;
  if (!cart || cart.items.length === 0) {
    const hasUnavailableItems = (cart?.unavailableItemCount ?? cart?.unavailableItems?.length ?? 0) > 0;
    return <EmptyState kind="cart" title={hasUnavailableItems ? "Your cart needs attention" : "Nothing to check out"} description={hasUnavailableItems ? "Remove unavailable products from your cart before checkout." : "Add items to your cart first."} action={<Button onClick={() => router.push(hasUnavailableItems ? "/cart" : "/")}>{hasUnavailableItems ? "Review your cart" : "Browse the mart"}</Button>} />;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Checkout</h1>

      {checkoutProblem ? <ErrorState variant="inline" error={checkoutProblem} /> : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {isCountryNeeded ? (
        <CountryRequiredPicker
          onSaved={() => {
            setCountryNeeded(false);
            checkoutKey.current = createIdempotencyKey("checkout");
            placeOrder.mutate();
          }}
        />
      ) : null}

      <div className={styles.layout}>
        <div className={styles.sections}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Shipping address</h2>
            {unavailableItemCount > 0 ? (
              <p className={styles.shippingNotice} role="alert">
                {unavailableItemCount} {unavailableItemCount === 1 ? "product is" : "products are"} unavailable. <Link href="/cart">Return to your cart</Link> to remove {unavailableItemCount === 1 ? "it" : "them"} before checkout.
              </p>
            ) : null}
            {addressesQuery.isError && !addressesQuery.data ? (
              <ErrorState description="We couldn't load your addresses." error={addressesQuery.error} onRetry={() => void addressesQuery.refetch()} />
            ) : (addressesQuery.data ?? []).length === 0 ? (
              <div className={styles.emptyAddress}>
                <p>You have no saved addresses yet.</p>
              </div>
            ) : (
              <ul className={styles.optionList}>
                {addressesQuery.data?.map((address) => (
                  <li key={address.id}>
                    <button
                      type="button"
                      className={[styles.optionRow, address.id === addressId ? styles.optionRowActive : ""].filter(Boolean).join(" ")}
                      aria-pressed={address.id === addressId}
                      onClick={() => setChosenAddressId(address.id)}
                    >
                      <MapPinIcon size={18} />
                      <span className={styles.optionText}>
                        <span className={styles.optionName}>{address.fullName}</span>
                        <span className={styles.optionMeta}>
                          {formatAddressLocation(address)}
                        </span>
                        <span className={styles.optionMeta}>{address.phone}</span>
                      </span>
                      {address.isDefault ? <span className={styles.tag}>Default</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {addressesQuery.isError && addressesQuery.data ? (
              <ErrorState variant="inline" description="Your saved addresses may be out of date." error={addressesQuery.error} onRetry={() => void addressesQuery.refetch()} />
            ) : null}
            <Button variant="secondary" onClick={() => setAddingAddress(true)}>
              Add a new address
            </Button>
            <AddressEditorDialog
              address={null}
              isOpen={isAddingAddress}
              onClose={() => setAddingAddress(false)}
              onSaved={(saved) => setChosenAddressId(saved.id)}
            />
            {quoteQuery.isError ? (
              <p className={styles.shippingNotice} role="alert">
                We couldn’t calculate delivery for this address. <button type="button" onClick={() => void quoteQuery.refetch()}>Try again</button>
              </p>
            ) : null}
            {currentQuote && blockedGroupCount > 0 && hasShippableGroup ? (
              <p className={styles.shippingNotice} role="status">
                Some sellers can’t deliver to this address. Those items will stay in your cart while the deliverable items are checked out.
              </p>
            ) : null}
            {currentQuote && blockedGroupCount > 0 && !hasShippableGroup ? (
              <p className={styles.shippingNotice} role="alert">
                None of these sellers can deliver to this address. Choose another address or update your cart to continue.
              </p>
            ) : null}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Payment method</h2>
            <CheckoutPaymentChoice
              channels={channelsQuery.data?.channels ?? []}
              wallet={walletQuery.data}
              total={orderTotal}
              source={walletChosen ? "wallet" : "hosted"}
              onChoose={setPaymentSource}
            />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>How to pay each seller</h2>
            <PaymentModeChooser groups={checkoutStoreGroups} modes={paymentModes} onChange={choosePaymentMode} />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{currentQuote ? "Items in this checkout" : "Cart items"}</h2>
            <ul className={styles.itemList}>
              {checkoutItems.map((item) => (
                <li key={item.id} className={styles.item}>
                  <span className={styles.itemName}>{item.product.name}</span>
                  <span className={styles.itemQty}>× {item.quantity}</span>
                </li>
              ))}
              {currentQuote && checkoutItems.length === 0 ? <li className={styles.shippingNotice}>No items from this cart can be checked out to this address.</li> : null}
            </ul>
          </section>
        </div>

        <aside className={styles.summary}>
          <h2 className={styles.summaryTitle}>Order summary</h2>
          <SellerGroupedSummary items={cart.items} quote={currentQuote} />
          <div className={styles.moneyRow}>
            <span>Items in this checkout</span>
            <span>{currentQuote ? formatMoneyForDisplay(currentQuote.itemsTotal) : quoteQuery.isFetching ? "Calculating" : "Choose an address"}</span>
          </div>
          <div className={styles.moneyRow}>
            <span>Shipping</span>
            <span>{currentQuote ? formatMoneyForDisplay(currentQuote.shipping) : quoteQuery.isError ? "Unavailable" : quoteQuery.isFetching ? "Calculating" : "Choose an address"}</span>
          </div>
          {currentQuote && currentQuote.shopDiscount.amountMinor > 0 ? (
            <div className={styles.moneyRow}>
              <span>Discount</span>
              <span>−{formatMoneyForDisplay(currentQuote.shopDiscount)}</span>
            </div>
          ) : null}
          {currentQuote && currentQuote.storeCredit.amountMinor > 0 ? (
            <div className={styles.moneyRow}>
              <span>Store credit</span>
              <span>−{formatMoneyForDisplay(currentQuote.storeCredit)}</span>
            </div>
          ) : null}
          <div className={styles.divider} />
          <div className={styles.moneyRowTotal}>
            <span>Total</span>
            <span>{currentQuote ? formatMoneyForDisplay(currentQuote.total) : quoteQuery.isError ? "Unavailable" : quoteQuery.isFetching ? "Calculating" : "Choose an address"}</span>
          </div>
          {accountEmailQuery.isPending ? (
            <p className={styles.verifyEmailNotice} role="status">Checking email verification before checkout…</p>
          ) : accountEmailQuery.isError ? (
            <div className={styles.verifyEmailNotice} role="alert">
              <p>We couldn’t confirm your email verification, so checkout is paused.</p>
              <Button variant="secondary" size="sm" onClick={() => void accountEmailQuery.refetch()}>
                Check again
              </Button>
            </div>
          ) : accountEmailQuery.data?.emailVerified !== true ? (
            <p className={styles.verifyEmailNotice} role="status">
              Verify your email to continue. <Link href="/verify-email?next=/checkout">Verify email</Link>
            </p>
          ) : (
            <Button size="lg" fullWidth busy={placeOrder.isPending} disabled={!addressId || !quoteReady || !hasShippableGroup || unavailableItemCount > 0 || placeOrder.isSuccess} onClick={() => {
              if (placeOrderInFlight.current) return;
              placeOrderInFlight.current = true;
              placeOrder.mutate(undefined, { onError: () => { placeOrderInFlight.current = false; } });
            }}>
              {!addressId ? "Choose an address" : walletChosen ? "Pay from wallet" : "Pay securely"}
            </Button>
          )}
          <p className={styles.terms}>
            {isNigeria
              ? "Escrow orders stay locked in your own wallet, held by our licensed payment partner, until you confirm delivery. Direct orders pay the seller right away."
              : "Outside Nigeria there's no escrow: you pay the seller directly, and our dispute process still applies. Nantty doesn't hold your money."}
          </p>
        </aside>
      </div>
    </div>
  );
}
