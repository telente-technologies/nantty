"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { RetryButton } from "@/components/ui/controls";
import { MediaImage } from "@/components/ui/media";
import { CloseIcon } from "@/components/ui/icons";
import { cartsService } from "@/services/carts.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatMoneyForDisplay, multiplyMoneyByQuantity } from "@/utils/formatMoney.util";

import styles from "./page.module.css";

function MoneyRow({ label, value, strong = false, muted = false }: { readonly label: string; readonly value: string; readonly strong?: boolean; readonly muted?: boolean }) {
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

  const cartQuery = useQuery({ queryKey: ["cart"], queryFn: cartsService.fetchMyCart, retry: false });

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

  if (cartQuery.isLoading) return <Spinner label="Loading your cart" />;
  if (cartQuery.isError) return <ErrorState description="We couldn't load your cart." action={<RetryButton onRetry={() => cartQuery.refetch()} />} />;

  const cart = cartQuery.data;
  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        icon="🛒"
        title="Your cart is empty"
        description="Browse the mart and add something you love."
        action={
          <Button onClick={() => router.push("/")}>Start shopping</Button>
        }
      />
    );
  }

  const hasDiscount = cart.shopDiscount.amountMinor > 0;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Cart</h1>

      <div className={styles.layout}>
        <ul className={styles.itemList}>
          {cart.items.map((item) => (
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
                      onClick={() => updateQuantity.mutate({ cartItemId: item.id, quantity: Math.max(1, item.quantity - 1) })}
                      disabled={item.quantity <= 1 || updateQuantity.isPending}
                    >
                      −
                    </button>
                    <span className={styles.quantityValue}>{item.quantity}</span>
                    <button
                      type="button"
                      className={styles.quantityButton}
                      aria-label={`Increase quantity of ${item.product.name}`}
                      onClick={() => updateQuantity.mutate({ cartItemId: item.id, quantity: Math.min(99, item.quantity + 1) })}
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

        <aside className={styles.summary}>
          <h2 className={styles.summaryTitle}>Summary</h2>
          <MoneyRow label="Items total" value={formatMoneyForDisplay(cart.itemsTotal)} />
          {hasDiscount ? <MoneyRow label="Discount" value={`−${formatMoneyForDisplay(cart.shopDiscount)}`} muted /> : null}
          <MoneyRow label="Shipping" value={cart.shipping.amountMinor > 0 ? formatMoneyForDisplay(cart.shipping) : "Calculated at checkout"} muted />
          <div className={styles.summaryDivider} />
          <MoneyRow label="Total" value={formatMoneyForDisplay(cart.total)} strong />
          <Button size="lg" fullWidth onClick={() => router.push("/checkout")}>
            Proceed to checkout
          </Button>
          <Link href="/" className={styles.continueLink}>
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
