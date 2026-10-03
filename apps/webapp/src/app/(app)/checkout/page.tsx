"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

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
import type { CheckoutResult, PaymentInitialization, PaymentProvider } from "@/types/commerce.type";

import styles from "./page.module.css";

const providers: readonly { readonly id: PaymentProvider; readonly name: string; readonly note: string }[] = [
  { id: "paystack", name: "Paystack", note: "Card, bank transfer or USSD" },
  { id: "flutterwave", name: "Flutterwave", note: "Card, bank transfer or mobile money" },
];

export default function CheckoutPage() {
  const router = useRouter();
  const accountEmailQuery = useQuery({ queryKey: ["account", "email"], queryFn: emailVerificationService.fetchAccountEmailStatus, retry: false });
  const cartQuery = useQuery({ queryKey: ["cart"], queryFn: cartsService.fetchMyCart, retry: false });
  const addressesQuery = useQuery({ queryKey: ["addresses"], queryFn: ordersService.fetchMyShippingAddresses, retry: false });

  const [chosenAddressId, setChosenAddressId] = useState<string | null>(null);
  const [provider, setProvider] = useState<PaymentProvider>("paystack");
  const [error, setError] = useState<string | null>(null);
  const checkoutKey = useRef(createIdempotencyKey("checkout"));

  const addressId = chosenAddressId ?? addressesQuery.data?.find((address) => address.isDefault)?.id ?? addressesQuery.data?.[0]?.id ?? null;

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!addressId) throw new Error("Choose a shipping address first.");
      const result = await sendRequestToWebappServer<CheckoutResult>("/api/v1/orders/checkout", {
        method: "POST",
        body: { addressId },
        idempotencyKey: checkoutKey.current,
      });
      const payment = await sendRequestToWebappServer<PaymentInitialization>("/api/v1/payments/initialize", {
        method: "POST",
        body: { orderId: result.payableOrderId, provider },
        idempotencyKey: `${checkoutKey.current}-pay`,
      });
      return payment;
    },
    onSuccess: (payment) => {
      sessionStorage.setItem(
        "zd_pending_payment",
        JSON.stringify({ orderId: payment.orderId, authorizationUrl: payment.authorizationUrl, reference: payment.reference }),
      );
      router.push(`/orders/${payment.orderId}`);
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
    return <EmptyState icon="🛒" title="Nothing to check out" description="Add items to your cart first." action={<Button onClick={() => router.push("/")}>Browse the mart</Button>} />;
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
                <p>Add one in the Zudomart mobile app.</p>
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
                          {address.line1}, {address.city}, {address.state}
                        </span>
                        <span className={styles.optionMeta}>{address.phone}</span>
                      </span>
                      {address.isDefault ? <span className={styles.tag}>Default</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Payment method</h2>
            <ul className={styles.optionList}>
              {providers.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    className={[styles.optionRow, provider === option.id ? styles.optionRowActive : ""].filter(Boolean).join(" ")}
                    aria-pressed={provider === option.id}
                    onClick={() => setProvider(option.id)}
                  >
                    <span className={styles.optionText}>
                      <span className={styles.optionName}>{option.name}</span>
                      <span className={styles.optionMeta}>{option.note}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
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
          <SellerGroupedSummary items={cart.items} />
          <div className={styles.moneyRow}>
            <span>Items total</span>
            <span>{formatMoneyForDisplay(cart.itemsTotal)}</span>
          </div>
          <div className={styles.moneyRow}>
            <span>Shipping</span>
            <span>{cart.shipping.amountMinor > 0 ? formatMoneyForDisplay(cart.shipping) : "Calculated at checkout"}</span>
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
            <span>{formatMoneyForDisplay(cart.total)}</span>
          </div>
          {accountEmailQuery.data?.emailVerified === false ? (
            <p className={styles.verifyEmailNotice} role="status">
              Verify your email to continue. <Link href="/verify-email?next=/checkout">Verify email</Link>
            </p>
          ) : (
            <Button size="lg" fullWidth busy={placeOrder.isPending} disabled={!addressId} onClick={() => placeOrder.mutate()}>
              {addressId ? `Pay with ${providers.find((option) => option.id === provider)?.name}` : "Choose an address"}
            </Button>
          )}
          <p className={styles.terms}>Payment is held in escrow until you confirm delivery.</p>
        </aside>
      </div>
    </div>
  );
}
