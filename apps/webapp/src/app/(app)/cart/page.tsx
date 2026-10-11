"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { addressesQueryKey } from "@/components/address/addressBook";
import { useShippingQuote } from "@/components/address/shippingQuote.hook";
import { SellerGroupedSummary } from "@/components/commerce/sellerGroupedSummary";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Avatar, MediaImage } from "@/components/ui/media";
import { CloseIcon, StoreIcon } from "@/components/ui/icons";
import { cartsService } from "@/services/carts.service";
import { ordersService } from "@/services/orders.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatMoneyForDisplay, multiplyMoneyByQuantity } from "@/utils/formatMoney.util";
import { groupCartItemsByStore } from "@/utils/groupCartItemsByStore.util";

import styles from "./page.module.css";

function MoneyRow({
  label,
  value,
  strong = false,
  muted = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly strong?: boolean;
  readonly muted?: boolean;
}) {
  return (
    <div className={[styles.moneyRow, strong ? styles.moneyRowStrong : "", muted ? styles.moneyRowMuted : ""].filter(Boolean).join(" ")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default function CartPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const cartQuery = useQuery({
    queryKey: ["cart"],
    queryFn: cartsService.fetchMyCart,
    retry: false,
  });

  const addressesQuery = useQuery({ queryKey: addressesQueryKey, queryFn: ordersService.fetchMyShippingAddresses, retry: false });
  const defaultAddress = addressesQuery.data?.find((address) => address.isDefault) ?? addressesQuery.data?.[0] ?? null;
  const quote = useShippingQuote(defaultAddress?.id ?? null).data ?? null;

  const invalidateCart = async () => {
    await queryClient.invalidateQueries({ queryKey: ["cart"] });
    await queryClient.invalidateQueries({ queryKey: ["shell", "cart"] });
  };

  const updateQuantity = useMutation({
    mutationFn: ({ cartItemId, quantity }: { readonly cartItemId: string; readonly quantity: number }) =>
      cartsService.changeCartItemQuantity(cartItemId, quantity),
    onSettled: invalidateCart,
  });

  const removeItem = useMutation({
    mutationFn: (cartItemId: string) => cartsService.removeCartItem(cartItemId),
    onSettled: invalidateCart,
  });

  if (cartQuery.isLoading) {
    return (
      <div className={styles.page} role="status" aria-label="Loading your cart">
        <Skeleton width={120} height={32} />
        <div className={styles.layout}>
          <Skeleton height={320} />
          <Skeleton height={280} />
        </div>
      </div>
    );
  }
  if (cartQuery.isError) return <ErrorState description="We couldn't load your cart." error={cartQuery.error} onRetry={() => void cartQuery.refetch()} />;

  const cart = cartQuery.data;
  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        kind="cart"
        title="Your cart is empty"
        description="Browse the mart and add something you love."
        action={<Button onClick={() => router.push("/mart")}>Start shopping</Button>}
      />
    );
  }

  const hasDiscount = cart.shopDiscount.amountMinor > 0;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Cart</h1>

      <div className={styles.layout}>
        <div className={styles.storeGroups}>
          {groupCartItemsByStore(cart.items).map((group) => (
            <section key={group.storeId} className={styles.storeGroup} aria-label={`Items from ${group.store?.name ?? "this seller"}`}>
              <header className={styles.storeHeader}>
                <Avatar name={group.store?.name ?? "Seller"} src={group.store?.logoUrl ?? null} size="sm" />
                <span className={styles.storeName}>
                  <StoreIcon size={15} /> {group.store?.name ?? "Seller"}
                </span>
                <span className={styles.storeSubtotal}>{formatMoneyForDisplay(group.subtotal)}</span>
              </header>
              <ul className={styles.itemList}>
                {group.items.map((item) => (
                  <li key={item.id} className={styles.item}>
                    <Link href={`/product/${item.product.id}`} className={styles.itemThumb}>
                      <MediaImage src={item.product.imageUrl} alt={item.product.name} sizes="96px" />
                    </Link>

                    <div className={styles.itemBody}>
                      <Link href={`/product/${item.product.id}`} className={styles.itemName}>
                        {item.product.name}
                      </Link>
                      {item.variant ? <p className={styles.itemVariant}>{item.variant}</p> : null}
                      <p className={styles.itemPrice}>{formatMoneyForDisplay(multiplyMoneyByQuantity(item.product.price, item.quantity))}</p>

                      <div className={styles.itemControls}>
                        <div className={styles.quantity}>
                          <button
                            type="button"
                            className={styles.quantityButton}
                            aria-label={`Decrease quantity of ${item.product.name}`}
                            onClick={() =>
                              updateQuantity.mutate({
                                cartItemId: item.id,
                                quantity: Math.max(1, item.quantity - 1),
                              })
                            }
                            disabled={item.quantity <= 1 || updateQuantity.isPending}
                          >
                            −
                          </button>
                          <span className={styles.quantityValue}>{item.quantity}</span>
                          <button
                            type="button"
                            className={styles.quantityButton}
                            aria-label={`Increase quantity of ${item.product.name}`}
                            onClick={() =>
                              updateQuantity.mutate({
                                cartItemId: item.id,
                                quantity: Math.min(99, item.quantity + 1),
                              })
                            }
                            disabled={updateQuantity.isPending}
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          className={styles.removeButton}
                          aria-label={`Remove ${item.product.name} from cart`}
                          onClick={() => removeItem.mutate(item.id)}
                          disabled={removeItem.isPending}
                        >
                          <CloseIcon size={16} /> Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className={styles.summary}>
          <h2 className={styles.summaryTitle}>Summary</h2>
          <SellerGroupedSummary items={cart.items} quote={quote} />
          <MoneyRow label="Items total" value={formatMoneyForDisplay(cart.itemsTotal)} />
          {hasDiscount ? <MoneyRow label="Discount" value={`−${formatMoneyForDisplay(cart.shopDiscount)}`} muted /> : null}
          {cart.storeCredit.amountMinor > 0 ? <MoneyRow label="Store credit" value={`−${formatMoneyForDisplay(cart.storeCredit)}`} muted /> : null}
          <MoneyRow label="Shipping" value={quote ? formatMoneyForDisplay(quote.shipping) : "Add an address to calculate"} muted />
          <div className={styles.summaryDivider} />
          <MoneyRow label="Total" value={formatMoneyForDisplay(quote ? quote.total : cart.total)} strong />
          <Button size="lg" fullWidth onClick={() => router.push("/checkout")}>
            Proceed to checkout
          </Button>
          <Link href="/mart" className={styles.continueLink}>
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
