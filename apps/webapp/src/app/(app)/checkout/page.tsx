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
import { RetryButton } from "@/components/ui/controls";
import { MapPinIcon } from "@/components/ui/icons";
import { cartsService } from "@/services/carts.service";
import { createIdempotencyKey, readErrorMessageForDisplay, sendRequestToWebappServer } from "@/services/clientApi.service";
import { ordersService } from "@/services/orders.service";
import { emailVerificationService } from "@/services/webActions.service";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { paymentsService } from "@/services/payments.service";
import type { CheckoutResult, PaymentChannel, PaymentInitialization } from "@/types/commerce.type";
import type { PaymentMode } from "@/types";
import { groupCartItemsByStore } from "@/utils/groupCartItemsByStore.util";
import { isDirectPaymentStore, toPaymentModeChoices } from "@/utils/paymentMode.util";
import { openPaystackCheckout } from "@/utils/paystackCheckout.util";

import styles from "./page.module.css";
import { AppIcon } from "@/components/ui/appIcon";

const channelLabels: Record<PaymentChannel, { readonly name: string; readonly note: string }> = {
  card: { name: "Card", note: "Debit or credit card" },
  bank_transfer: { name: "Bank transfer", note: "Pay from your bank app" },
  ussd: { name: "USSD", note: "Pay with a code from your phone" },
};

export default function CheckoutPage() {
  const router = useRouter();
  const accountEmailQuery = useQuery({ queryKey: ["account", "email"], queryFn: emailVerificationService.fetchAccountEmailStatus, retry: false });
  const cartQuery = useQuery({ queryKey: ["cart"], queryFn: cartsService.fetchMyCart, retry: false });
  const addressesQuery = useQuery({ queryKey: addressesQueryKey, queryFn: ordersService.fetchMyShippingAddresses, retry: false });

  const [chosenAddressId, setChosenAddressId] = useState<string | null>(null);
  const channelsQuery = useQuery({ queryKey: ["payments", "channels"], queryFn: paymentsService.fetchPaymentChannels, retry: false });
  const [error, setError] = useState<string | null>(null);
  const checkoutKey = useRef(createIdempotencyKey("checkout"));
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
        body: { addressId, paymentModes: toPaymentModeChoices(directChoices) },
        idempotencyKey: checkoutKey.current,
      });
      const payment = await sendRequestToWebappServer<PaymentInitialization>("/api/v1/payments/initialize", {
        method: "POST",
        body: { orderId: result.payableOrderId, provider: "paystack" },
        idempotencyKey: `${checkoutKey.current}-pay`,
      });
      return payment;
    },
    onSuccess: async (payment) => {
      sessionStorage.setItem(
        "zd_pending_payment",
        JSON.stringify({ orderId: payment.orderId, authorizationUrl: payment.authorizationUrl, reference: payment.reference }),
      );
      const outcome = await openPaystackCheckout(payment);
      if (outcome !== "redirected") router.push(`/orders/${payment.orderId}`);
    },
    onError: (caught) => setError(readErrorMessageForDisplay(caught)),
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
  if (cartQuery.isError) return <ErrorState description="We couldn't load your cart." action={<RetryButton onRetry={() => cartQuery.refetch()} />} />;

  const cart = cartQuery.data;
  if (!cart || cart.items.length === 0) {
    return <EmptyState icon={<AppIcon name="shoppingCart24" size={28} />} title="Nothing to check out" description="Add items to your cart first." action={<Button onClick={() => router.push("/")}>Browse the mart</Button>} />;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Checkout</h1>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.sections}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Shipping address</h2>
            {addressesQuery.isError ? (
              <ErrorState description="We couldn't load your addresses." action={<RetryButton onRetry={() => addressesQuery.refetch()} />} />
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
            <ul className={styles.optionList}>
              {(channelsQuery.data?.channels ?? []).map((channel) => (
                <li key={channel}>
                  <div className={styles.optionRow}>
                    <span className={styles.optionText}>
                      <span className={styles.optionName}>{channelLabels[channel].name}</span>
                      <span className={styles.optionMeta}>{channelLabels[channel].note}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <p className={styles.optionMeta}>You'll choose how to pay in the secure payment window. We never see your card details.</p>
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
            <Button size="lg" fullWidth busy={placeOrder.isPending} disabled={!addressId || quoteQuery.isFetching || !hasShippableGroup} onClick={() => placeOrder.mutate()}>
              {addressId ? "Pay now" : "Choose an address"}
            </Button>
          )}
          <p className={styles.terms}>Escrow orders are held until you confirm delivery. Direct orders pay the seller right away.</p>
        </aside>
      </div>
    </div>
  );
}
