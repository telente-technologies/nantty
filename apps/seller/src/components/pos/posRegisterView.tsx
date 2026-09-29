"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PosCameraScannerDialog, isCameraBarcodeScanningSupported } from "@/components/pos/posCameraScannerDialog";
import { PosCouponDialog } from "@/components/pos/posCouponDialog";
import { PosCustomerDialog } from "@/components/pos/posCustomerDialog";
import { PosDiscountDialog, type PosDiscountTarget } from "@/components/pos/posDiscountDialog";
import { PosParkedSalesDialog } from "@/components/pos/posParkedSalesDialog";
import { PosPaymentDialog } from "@/components/pos/posPaymentDialog";
import { PosProductGrid } from "@/components/pos/posProductGrid";
import { PosReceiptTapeCart } from "@/components/pos/posReceiptTapeCart";
import { PosOpenShiftPrompt, PosRegisterPicker } from "@/components/pos/posRegisterPicker";
import { PosSaleCompleteDialog } from "@/components/pos/posSaleCompleteDialog";
import { PosShortcutsList } from "@/components/pos/posShortcutsList";
import { PosVariantPickerDialog } from "@/components/pos/posVariantPickerDialog";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { usePosBarcodeScanner } from "@/hooks/usePosBarcodeScanner.hook";
import { usePosCart } from "@/hooks/usePosCart.hook";
import { usePosCheckout } from "@/hooks/usePosCheckout.hook";
import { usePosKeyboardShortcuts } from "@/hooks/usePosKeyboardShortcuts.hook";
import { usePosRegisterContext } from "@/hooks/usePosRegisterContext.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { Product } from "@/types/catalog.type";
import type { DiscountInput } from "@/types/pos.type";
import { findVariantByScannedCode } from "@/utils/posCatalog.util";

import styles from "./posRegisterView.module.css";

type OpenDialog = "customer" | "coupon" | "payment" | "parked" | "camera" | "shortcuts" | null;
type DiscountScope = { readonly kind: "cart" } | { readonly kind: "line"; readonly lineId: string } | null;

export function PosRegisterView() {
  const { showToast } = useToast();
  const { can } = useSellerSession();
  const { locations } = useStoreContext();
  const { catalog, isCatalogLoading, selectedRegister, locationId, isLocked, isOnline } = usePosRegisterContext();
  const settings = catalog?.settings ?? null;
  const cartController = usePosCart(selectedRegister?.id ?? null, settings);
  const { cart, pricedCart, addVariantToCart, setLineQuantity, removeCartLine, setLineDiscount, setCartDiscount, setCartCustomer, setCartCoupon, setLoyaltyPointsToRedeem, replaceCart } = cartController;
  const checkout = usePosCheckout(cartController, settings);
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [discountScope, setDiscountScope] = useState<DiscountScope>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isSelling = Boolean(settings && selectedRegister?.openShiftId && !isLocked);
  const locationName = locations.find((location) => location.id === locationId)?.name ?? null;

  useEffect(() => {
    const lastLine = cart.lines.at(-1);
    if (!cart.lines.some((line) => line.lineId === selectedLineId)) setSelectedLineId(lastLine?.lineId ?? null);
  }, [cart.lines, selectedLineId]);

  const chooseProduct = useCallback(
    (product: Product) => {
      const onlyVariant = product.variants.length === 1 ? product.variants[0] : undefined;
      if (onlyVariant) addVariantToCart(product, onlyVariant);
      else setVariantProduct(product);
    },
    [addVariantToCart],
  );

  const addItemForScannedCode = useCallback(
    (code: string) => {
      const match = catalog ? findVariantByScannedCode(catalog.products, code) : null;
      if (!match) {
        showToast(`No item has the code “${code.trim()}”.`, "error");
        return false;
      }
      addVariantToCart(match.product, match.variant);
      return true;
    },
    [catalog, addVariantToCart, showToast],
  );

  usePosBarcodeScanner((code) => void addItemForScannedCode(code), isSelling && openDialog === null && variantProduct === null && discountScope === null);

  const moveLineSelection = useCallback(
    (offset: number) => {
      const currentIndex = cart.lines.findIndex((line) => line.lineId === selectedLineId);
      const nextLine = cart.lines[Math.min(Math.max(currentIndex + offset, 0), cart.lines.length - 1)];
      if (nextLine) setSelectedLineId(nextLine.lineId);
    },
    [cart.lines, selectedLineId],
  );
  const selectedLine = cart.lines.find((line) => line.lineId === selectedLineId);

  usePosKeyboardShortcuts(
    {
      focusSearch: () => searchInputRef.current?.focus(),
      openCustomer: () => setOpenDialog("customer"),
      parkSale: () => void checkout.parkCurrentSale(),
      openPayment: () => cart.lines.length > 0 && setOpenDialog("payment"),
      increaseSelectedQuantity: () => selectedLine && setLineQuantity(selectedLine.lineId, selectedLine.quantity + 1),
      decreaseSelectedQuantity: () => selectedLine && setLineQuantity(selectedLine.lineId, selectedLine.quantity - 1),
      removeSelectedLine: () => selectedLine && removeCartLine(selectedLine.lineId),
      showShortcuts: () => setOpenDialog("shortcuts"),
      selectPreviousLine: () => moveLineSelection(-1),
      selectNextLine: () => moveLineSelection(1),
    },
    isSelling,
  );

  const discountTarget = useMemo<PosDiscountTarget | null>(() => {
    if (!discountScope || !pricedCart) return null;
    if (discountScope.kind === "cart") return { label: "the whole sale", grossMinor: pricedCart.subtotalMinor - pricedCart.lineDiscountTotalMinor, currentDiscount: cart.cartDiscount };
    const lineIndex = cart.lines.findIndex((line) => line.lineId === discountScope.lineId);
    const line = cart.lines[lineIndex];
    return line ? { label: line.name, grossMinor: line.unitPriceMinor * line.quantity, currentDiscount: line.discount } : null;
  }, [discountScope, pricedCart, cart]);

  function applyDiscountToScope(discount: DiscountInput | null) {
    if (discountScope?.kind === "cart") setCartDiscount(discount);
    else if (discountScope?.kind === "line") setLineDiscount(discountScope.lineId, discount);
    setDiscountScope(null);
  }

  if (!locationId || (isCatalogLoading && !catalog)) return <LoadingBlock label="Loading the register" />;
  if (!catalog || !settings) return <EmptyState iconName="warning20" title="The catalog is not available" description="Connect to the internet once so the register can download your products for offline use." />;
  if (!selectedRegister) return <PosRegisterPicker />;
  if (!selectedRegister.openShiftId) return isOnline ? <PosOpenShiftPrompt currency={settings.currency} /> : <EmptyState iconName="warning20" title="No open shift on this register" description="Opening a shift needs a connection. Reconnect, then open the shift." />;

  return (
    <div className={styles.register}>
      <PosProductGrid products={catalog.products} categories={catalog.categories} locationId={locationId} searchInputRef={searchInputRef} onProductChosen={chooseProduct} onCodeEntered={addItemForScannedCode} onOpenCameraScanner={isCameraBarcodeScanningSupported() ? () => setOpenDialog("camera") : null} />
      <PosReceiptTapeCart
        cartController={cartController}
        currency={settings.currency}
        pricesIncludeTax={settings.pricesIncludeTax}
        selectedLineId={selectedLineId}
        onSelectLine={setSelectedLineId}
        onOpenLineDiscount={(lineId) => setDiscountScope({ kind: "line", lineId })}
        onOpenCartDiscount={() => setDiscountScope({ kind: "cart" })}
        onOpenCustomer={() => setOpenDialog("customer")}
        onOpenCoupon={() => setOpenDialog("coupon")}
        onPark={() => void checkout.parkCurrentSale()}
        onRecall={() => setOpenDialog("parked")}
        onPay={() => setOpenDialog("payment")}
      />
      <button type="button" className={styles.shortcutHint} onClick={() => setOpenDialog("shortcuts")}>Keyboard shortcuts (?)</button>
      <PosVariantPickerDialog product={variantProduct} locationId={locationId} onClose={() => setVariantProduct(null)} onChoose={(product, variant) => { addVariantToCart(product, variant); setVariantProduct(null); }} />
      <PosDiscountDialog target={discountTarget} currency={settings.currency} approvalThresholdBasisPoints={settings.discountApprovalThresholdBasisPoints} canApproveOwnDiscounts={can("pos:approve_discount")} locationId={locationId} onApply={applyDiscountToScope} onClose={() => setDiscountScope(null)} />
      <PosCustomerDialog isOpen={openDialog === "customer"} currentCustomer={cart.customer} loyaltyPointsToRedeem={cart.loyaltyPointsToRedeem} loyalty={settings.loyalty} onChooseCustomer={setCartCustomer} onRedeemPoints={setLoyaltyPointsToRedeem} onClose={() => setOpenDialog(null)} />
      <PosCouponDialog isOpen={openDialog === "coupon"} subtotalMinor={pricedCart?.subtotalMinor ?? 0} onApply={(coupon) => { setCartCoupon(coupon); setOpenDialog(null); showToast(coupon.message || `Coupon ${coupon.code} applied.`); }} onClose={() => setOpenDialog(null)} />
      <PosParkedSalesDialog isOpen={openDialog === "parked"} registerId={selectedRegister.id} onClose={() => setOpenDialog(null)} onRecall={(recalledCart) => { if (cart.lines.length === 0 || window.confirm("Replace the current sale with the parked one? The current items will be cleared.")) { replaceCart(recalledCart); setOpenDialog(null); } }} />
      <PosCameraScannerDialog isOpen={openDialog === "camera"} onClose={() => setOpenDialog(null)} onDetected={(code) => { setOpenDialog(null); addItemForScannedCode(code); }} />
      <ModalDialog isOpen={openDialog === "shortcuts"} onClose={() => setOpenDialog(null)} title="Register shortcuts" width="small">
        <PosShortcutsList />
      </ModalDialog>
      <PosPaymentDialog isOpen={openDialog === "payment"} totalMinor={pricedCart?.totalMinor ?? 0} currency={settings.currency} paymentMethods={settings.paymentMethods} clientSaleId={cart.clientSaleId} isOnline={isOnline} isCompleting={checkout.isCompleting} onClose={() => setOpenDialog(null)} onComplete={async (payments) => { if (await checkout.completeSaleWithPayments(payments)) setOpenDialog(null); }} />
      <PosSaleCompleteDialog sale={checkout.completedSale?.sale ?? null} isPendingSync={checkout.completedSale?.isPendingSync ?? false} settings={settings} locationName={locationName} onStartNewSale={() => { checkout.finishCompletedSale(); searchInputRef.current?.focus(); }} />
    </div>
  );
}
