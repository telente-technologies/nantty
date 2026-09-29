"use client";

import { Button, IconButton } from "@/components/ui/button";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { PosCartController } from "@/hooks/usePosCart.hook";
import type { CurrencyCode } from "@/types/money.type";
import { formatBasisPointsAsPercent } from "@/utils/money.util";

import styles from "./posReceiptTapeCart.module.css";

interface PosReceiptTapeCartProps {
  readonly cartController: PosCartController;
  readonly currency: CurrencyCode;
  readonly pricesIncludeTax: boolean;
  readonly selectedLineId: string | null;
  readonly onSelectLine: (lineId: string) => void;
  readonly onOpenLineDiscount: (lineId: string) => void;
  readonly onOpenCartDiscount: () => void;
  readonly onOpenCustomer: () => void;
  readonly onOpenCoupon: () => void;
  readonly onPark: () => void;
  readonly onRecall: () => void;
  readonly onPay: () => void;
}

export function PosReceiptTapeCart({ cartController, currency, pricesIncludeTax, selectedLineId, onSelectLine, onOpenLineDiscount, onOpenCartDiscount, onOpenCustomer, onOpenCoupon, onPark, onRecall, onPay }: PosReceiptTapeCartProps) {
  const { formatMoney } = useMoneyFormatter();
  const { cart, pricedCart, setLineQuantity, removeCartLine, setCartCoupon, setCartDiscount } = cartController;
  const money = (amountMinor: number) => formatMoney({ amountMinor, currency });
  const hasLines = cart.lines.length > 0;

  return (
    <section className={styles.cartColumn} aria-label="Current sale">
      <div className={styles.tape}>
        <header className={styles.tapeHeader}>
          <span className={styles.tapeTitle}>Current sale</span>
          <button type="button" className={styles.customerChip} onClick={onOpenCustomer}>
            {cart.customer ? `${cart.customer.name}${cart.customer.loyaltyPoints ? ` · ${cart.customer.loyaltyPoints} pts` : ""}` : "+ Customer (F4)"}
          </button>
        </header>
        <ol className={styles.lines} aria-label="Items in this sale">
          {cart.lines.map((line, index) => {
            const pricedLine = pricedCart?.lines[index];
            const isSelected = line.lineId === selectedLineId;
            return (
              <li key={line.lineId} className={`${styles.line} ${isSelected ? styles.selectedLine : ""}`} aria-current={isSelected ? "true" : undefined}>
                <button type="button" className={styles.lineMain} onClick={() => onSelectLine(line.lineId)}>
                  <span className={styles.lineName}>{line.name}</span>
                  <span className={styles.lineDetail}>
                    {line.variantTitle !== "Default" ? `${line.variantTitle} · ` : ""}
                    {line.quantity} × {money(line.unitPriceMinor)}
                    {line.discount ? ` · −${line.discount.kind === "percent" ? formatBasisPointsAsPercent(line.discount.value) : money(line.discount.value)}` : ""}
                  </span>
                </button>
                <span className={styles.lineAmount}>{money((pricedLine?.grossMinor ?? 0) - (pricedLine?.lineDiscountMinor ?? 0))}</span>
                {isSelected ? (
                  <div className={styles.lineActions}>
                    <IconButton iconName="minus16" label={`Decrease quantity of ${line.name}`} size="small" variant="secondary" onClick={() => setLineQuantity(line.lineId, line.quantity - 1)} />
                    <label className={styles.quantityField}>
                      <span className="visuallyHidden">Quantity of {line.name}</span>
                      <input type="number" inputMode="numeric" min={1} max={9999} value={line.quantity} onChange={(event) => { const quantity = Number(event.target.value); if (Number.isInteger(quantity) && quantity >= 1) setLineQuantity(line.lineId, quantity); }} />
                    </label>
                    <IconButton iconName="plus16" label={`Increase quantity of ${line.name}`} size="small" variant="secondary" onClick={() => setLineQuantity(line.lineId, line.quantity + 1)} />
                    <Button size="small" variant="ghost" iconName="tag24" onClick={() => onOpenLineDiscount(line.lineId)}>Discount</Button>
                    <IconButton iconName="trash24" label={`Remove ${line.name}`} size="small" variant="ghost" onClick={() => removeCartLine(line.lineId)} />
                  </div>
                ) : null}
                <span className="visuallyHidden">Item {index + 1}</span>
              </li>
            );
          })}
          {!hasLines ? <li className={styles.emptyTape}>Scan a barcode or tap a product to start a sale.</li> : null}
        </ol>
        {pricedCart && hasLines ? (
          <dl className={styles.totals}>
            <div><dt>Subtotal · {pricedCart.itemsCount} items</dt><dd>{money(pricedCart.subtotalMinor)}</dd></div>
            {pricedCart.lineDiscountTotalMinor > 0 ? <div><dt>Item discounts</dt><dd>−{money(pricedCart.lineDiscountTotalMinor)}</dd></div> : null}
            {pricedCart.cartDiscountMinor > 0 ? (
              <div><dt><button type="button" className={styles.inlineRemove} onClick={() => setCartDiscount(null)} aria-label="Remove cart discount">Cart discount ✕</button></dt><dd>−{money(pricedCart.cartDiscountMinor)}</dd></div>
            ) : null}
            {cart.coupon ? (
              <div><dt><button type="button" className={styles.inlineRemove} onClick={() => setCartCoupon(null)} aria-label={`Remove coupon ${cart.coupon.code}`}>Coupon {cart.coupon.code} ✕</button></dt><dd>−{money(pricedCart.couponDiscountMinor)}</dd></div>
            ) : null}
            {pricedCart.loyaltyRedemptionMinor > 0 ? <div><dt>Loyalty points</dt><dd>−{money(pricedCart.loyaltyRedemptionMinor)}</dd></div> : null}
            <div><dt>{pricesIncludeTax ? "Tax included" : "Tax"}</dt><dd>{money(pricedCart.taxTotalMinor)}</dd></div>
            <div className={styles.grandTotal}><dt>Total</dt><dd>{money(pricedCart.totalMinor)}</dd></div>
          </dl>
        ) : null}
      </div>
      <div className={styles.actionGrid}>
        <Button onClick={onOpenCartDiscount} disabled={!hasLines}>Discount</Button>
        <Button onClick={onOpenCoupon} disabled={!hasLines}>Coupon</Button>
        <Button onClick={onPark} disabled={!hasLines}>Park (F8)</Button>
        <Button onClick={onRecall}>Recall</Button>
      </div>
      <Button variant="primary" size="large" fullWidth disabled={!hasLines} onClick={onPay} className={styles.payButton}>
        {pricedCart && hasLines ? `Pay ${money(pricedCart.totalMinor)}` : "Pay"} · F9
      </Button>
    </section>
  );
}
