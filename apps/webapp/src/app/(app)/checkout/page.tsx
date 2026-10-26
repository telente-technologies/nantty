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
import { createIdempotencyKey, readErrorMessageForDisplay, sendRequestToWebappServer, WebappRequestError } from "@/services/clientApi.service";
import { CountryRequiredPicker, countryRequiredCode } from "@/components/commerce/countryRequiredPicker";
import { ordersService } from "@/services/orders.service";
import { emailVerificationService } from "@/services/webActions.service";
import { useMutation, useQuery } from "@tanstack/react-query";
import { describeErrorSignal, readErrorSignal } from "@nantty/web-kit";
import { CheckoutPaymentChoice, canPayFromWallet, type CheckoutPaymentSource } from "@/components/commerce/checkoutPaymentChoice";
import { providerWalletQueryKeys, providerWalletService } from "@/services/providerWallet.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { paymentsService } from "@/services/payments.service";
import type { CheckoutResult } from "@/types/commerce.type";
import type { PaymentMode } from "@/types";
import { groupCartItemsByStore } from "@/utils/groupCartItemsByStore.util";
import { isDirectPaymentStore, toPaymentModeChoices } from "@/utils/paymentMode.util";
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
  const hasShippableGroup = quote?.groups.some((group) => group.status === "calculated") ?? false;

  const orderTotal = quote ? quote.total : (cartQuery.data?.total ?? null);
  const walletChosen = paymentSource === "wallet" && canPayFromWallet(walletQuery.data, orderTotal);
  const isNigeria = (verificationQuery.data?.country ?? "NG") === "NG";
  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!addressId) throw new Error("Choose a shipping address first.");
      const directChoices = Object.fromEntries(
        groupCartItemsByStore(cartQuery.data?.items ?? [])
          .filter((group) => isDirectPaymentStore(group.store))
          .map((group) => [group.storeId, paymentModes[group.storeId] ?? "escrow"] as const),
      );
      const result = await sendRequestToWebappServer<CheckoutResult>("/api/v1/orders/checkout", {
        method: "POST",
        body: { addressId, paymentModes: toPaymentModeChoices(directChoices), directPaymentAccepted: Object.values(directChoices).includes("direct") },
        idempotencyKey: checkoutKey.current,
      });
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
    return <EmptyState kind="cart" title="Nothing to check out" description="Add items to your cart first." action={<Button onClick={() => router.push("/")}>Browse the mart</Button>} />;
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
            {addressesQuery.isError ? (
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
            <Button variant="secondary" onClick={() => setAddingAddress(true)}>
              Add a new address
            </Button>
            <AddressEditorDialog
              address={null}
              isOpen={isAddingAddress}
              onClose={() => setAddingAddress(false)}
              onSaved={(saved) => setChosenAddressId(saved.id)}
            />
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
            <PaymentModeChooser groups={groupCartItemsByStore(cart.items)} modes={paymentModes} onChange={choosePaymentMode} />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Items</h2>
            <ul className={styles.itemList}>
              {cart.items.map((item) => (
                <li key={item.id} className={styles.item}>
                  <span className={styles.itemName}>{item.product.name}</span>
                  <span className={styles.itemQty}>× {item.quantity}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className={styles.summary}>
          <h2 className={styles.summaryTitle}>Order summary</h2>
          <SellerGroupedSummary items={cart.items} quote={quote} />
          <div className={styles.moneyRow}>
            <span>Items total</span>
            <span>{formatMoneyForDisplay(cart.itemsTotal)}</span>
          </div>
          <div className={styles.moneyRow}>
            <span>Shipping</span>
            <span>{quote ? formatMoneyForDisplay(quote.shipping) : quoteQuery.isFetching ? "Calculating" : "Choose an address"}</span>
          </div>
          {cart.storeCredit.amountMinor > 0 ? (
            <div className={styles.moneyRow}>
              <span>Store credit</span>
              <span>−{formatMoneyForDisplay(cart.storeCredit)}</span>
            </div>
          ) : null}
          <div className={styles.divider} />
          <div className={styles.moneyRowTotal}>
            <span>Total</span>
            <span>{formatMoneyForDisplay(quote ? quote.total : cart.total)}</span>
          </div>
          {accountEmailQuery.data?.emailVerified === false ? (
            <p className={styles.verifyEmailNotice} role="status">
              Verify your email to continue. <Link href="/verify-email?next=/checkout">Verify email</Link>
            </p>
          ) : (
            <Button size="lg" fullWidth busy={placeOrder.isPending} disabled={!addressId || quoteQuery.isFetching || !hasShippableGroup || placeOrder.isSuccess} onClick={() => {
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
