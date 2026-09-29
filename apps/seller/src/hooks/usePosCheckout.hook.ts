"use client";

import { useCallback, useState } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { useToast } from "@/components/ui/toastProvider";
import type { PosCartController } from "@/hooks/usePosCart.hook";
import { usePosRegisterContext } from "@/hooks/usePosRegisterContext.hook";
import { SellerApiRequestError, createIdempotencyKey, readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import { isOfflineRequestError, submitPosSaleOrQueueWhenOffline } from "@/services/posOfflineSaleQueue.service";
import type { PosSale } from "@/types/pos.type";
import type { LocallyParkedSale, PendingPayment } from "@/types/posExtra.type";
import type { StoreSettings } from "@/types/store.type";
import { formatTimeForDisplay } from "@/utils/dateFormatting.util";
import { posObjectStoreNames, writeRecordToOfflineStore } from "@/utils/posOfflineDatabase.util";
import { buildCreateSaleRequestFromCart, buildLocalPosSaleFromCart } from "@/utils/posSaleBuilder.util";

export function usePosCheckout(cartController: PosCartController, settings: StoreSettings | null) {
  const { showToast } = useToast();
  const { sessionView } = useSellerSession();
  const { selectedRegister, locationId, rememberRegisterShift, refreshQueuedSales, reportRequestOutcome, reloadCatalog } = usePosRegisterContext();
  const [isCompleting, setIsCompleting] = useState(false);
  const [completedSale, setCompletedSale] = useState<{ sale: PosSale; isPendingSync: boolean } | null>(null);
  const [isParking, setIsParking] = useState(false);

  const completeSaleWithPayments = useCallback(
    async (payments: PendingPayment[]) => {
      const { cart, pricedCart } = cartController;
      if (!settings || !pricedCart || !selectedRegister?.openShiftId || !locationId) return false;
      const operator = sessionView?.operator;
      const context = {
        registerId: selectedRegister.id,
        shiftId: selectedRegister.openShiftId,
        locationId,
        cashier: operator ? { id: operator.staffId, name: operator.name } : { id: sessionView?.user.id ?? "", name: sessionView?.user.name ?? "Cashier" },
      };
      setIsCompleting(true);
      try {
        const outcome = await submitPosSaleOrQueueWhenOffline(buildCreateSaleRequestFromCart(cart, payments, context), buildLocalPosSaleFromCart(cart, pricedCart, settings, payments, context));
        setCompletedSale({ sale: outcome.sale, isPendingSync: outcome.kind === "queued" });
        if (outcome.kind === "queued") {
          reportRequestOutcome(true);
          await refreshQueuedSales();
        } else {
          reportRequestOutcome(false);
          reloadCatalog();
        }
        return true;
      } catch (error) {
        if (error instanceof SellerApiRequestError && error.code === "SHIFT_CLOSED") rememberRegisterShift(selectedRegister.id, null);
        showToast(readErrorMessageForDisplay(error), "error");
        return false;
      } finally {
        setIsCompleting(false);
      }
    },
    [cartController, settings, selectedRegister, locationId, sessionView, reportRequestOutcome, refreshQueuedSales, reloadCatalog, rememberRegisterShift, showToast],
  );

  const parkCurrentSale = useCallback(async () => {
    const { cart, pricedCart, startNewSale } = cartController;
    if (!selectedRegister || !pricedCart || cart.lines.length === 0 || !settings) return;
    const label = cart.customer ? `${cart.customer.name}'s sale` : `Sale at ${formatTimeForDisplay(new Date().toISOString(), settings.locale, settings.timezone)}`;
    setIsParking(true);
    try {
      await sendSellerApiRequest("/seller/pos/parked-sales", { method: "POST", body: { registerId: selectedRegister.id, label, customerName: cart.customer?.name ?? null, itemsCount: pricedCart.itemsCount, totalMinor: pricedCart.totalMinor, cart } });
      showToast(`Parked “${label}”.`);
      startNewSale();
    } catch (error) {
      if (!isOfflineRequestError(error)) {
        showToast(readErrorMessageForDisplay(error), "error");
        return;
      }
      const locallyParkedSale: LocallyParkedSale = { id: createIdempotencyKey("park"), registerId: selectedRegister.id, label, customerName: cart.customer?.name ?? null, itemsCount: pricedCart.itemsCount, total: { amountMinor: pricedCart.totalMinor, currency: pricedCart.currency }, cart, createdAt: new Date().toISOString() };
      await writeRecordToOfflineStore(posObjectStoreNames.parkedSales, locallyParkedSale);
      showToast(`Parked “${label}” on this device.`, "info");
      startNewSale();
    } finally {
      setIsParking(false);
    }
  }, [cartController, selectedRegister, settings, showToast]);

  const finishCompletedSale = useCallback(() => {
    setCompletedSale(null);
    cartController.startNewSale();
  }, [cartController]);

  return { isCompleting, completedSale, completeSaleWithPayments, parkCurrentSale, isParking, finishCompletedSale };
}
