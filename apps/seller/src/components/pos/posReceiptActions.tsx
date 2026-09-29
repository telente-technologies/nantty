"use client";

import { useState } from "react";

import { PosReceiptPrintPortal } from "@/components/pos/posReceiptDocument";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { PosSale } from "@/types/pos.type";
import type { ReceiptShareChannel, ReceiptShareResult } from "@/types/posExtra.type";
import type { StoreSettings } from "@/types/store.type";
import { triggerBrowserDownload } from "@/utils/csvFile.util";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";
import { fieldChecks } from "@/utils/formValidation.util";
import { readMinorUnitsPerMajorUnit } from "@/utils/money.util";
import { buildMonospaceReceiptPdf } from "@/utils/receiptPdf.util";
import { buildReceiptTextLines } from "@/utils/receiptText.util";

import styles from "./posDialogs.module.css";

interface PosReceiptActionsProps {
  readonly sale: PosSale;
  readonly settings: StoreSettings;
  readonly locationName: string | null;
  readonly isPendingSync: boolean;
}

export function PosReceiptActions({ sale, settings, locationName, isPendingSync }: PosReceiptActionsProps) {
  const { showToast } = useToast();
  const [channel, setChannel] = useState<ReceiptShareChannel>("whatsapp");
  const [destination, setDestination] = useState(sale.customer?.phone ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  function downloadReceiptAsPdf() {
    const codeFormatter = new Intl.NumberFormat(settings.locale, { style: "currency", currency: sale.total.currency, currencyDisplay: "code" });
    const lines = buildReceiptTextLines(sale, {
      settings,
      locationName,
      isPendingSync,
      formatAmount: (money) => codeFormatter.format(money.amountMinor / readMinorUnitsPerMajorUnit(money.currency)),
      formatDateTime: (isoDate) => formatDateTimeForDisplay(isoDate, settings.locale, settings.timezone),
    });
    triggerBrowserDownload(`receipt-${isPendingSync ? sale.clientSaleId : sale.receiptNumber}.pdf`, buildMonospaceReceiptPdf(lines, settings.receipt.paperWidth === "58mm" ? 58 : 80));
  }

  async function shareReceipt() {
    const trimmedDestination = destination.trim();
    const destinationError = channel === "email" ? fieldChecks.email()(trimmedDestination) : channel === "sms" ? fieldChecks.phone()(trimmedDestination) : trimmedDestination ? fieldChecks.phone()(trimmedDestination) : null;
    if (destinationError) {
      setErrorMessage(destinationError);
      return;
    }
    setIsSharing(true);
    setErrorMessage(null);
    const whatsappWindow = channel === "whatsapp" ? window.open("about:blank", "_blank") : null;
    try {
      const result = await sendSellerApiRequest<ReceiptShareResult>(`/seller/pos/sales/${encodeURIComponent(sale.id)}/share`, { method: "POST", body: { channel, destination: trimmedDestination || undefined } });
      if (channel === "whatsapp") {
        const phoneDigits = trimmedDestination.replace(/\D/g, "");
        const whatsappUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(result.message)}`;
        if (whatsappWindow) {
          whatsappWindow.opener = null;
          whatsappWindow.location.href = whatsappUrl;
        } else window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      } else showToast(`Receipt sent to ${result.sentTo ?? trimmedDestination}.`);
    } catch (error) {
      whatsappWindow?.close();
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <div className={styles.formStack}>
      <PosReceiptPrintPortal sale={sale} settings={settings} locationName={locationName} isPendingSync={isPendingSync} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button variant="primary" iconName="textIndent24" onClick={() => window.print()}>Print receipt</Button>
        <Button iconName="export24" onClick={downloadReceiptAsPdf}>Download PDF</Button>
      </div>
      {isPendingSync ? (
        <Callout tone="info">Sharing a receipt link works once this sale has synced.</Callout>
      ) : (
        <form className={styles.formRow} onSubmit={(event) => { event.preventDefault(); void shareReceipt(); }}>
          <SelectField label="Send receipt by" value={channel} onChange={(event) => setChannel(event.target.value as ReceiptShareChannel)} options={[{ value: "whatsapp", label: "WhatsApp" }, { value: "sms", label: "SMS" }, { value: "email", label: "Email" }]} />
          <TextField label={channel === "email" ? "Email address" : channel === "sms" ? "Phone number" : "Phone (optional)"} type={channel === "email" ? "email" : "tel"} value={destination} onChange={(event) => setDestination(event.target.value)} maxLength={254} />
          <Button type="submit" isBusy={isSharing} iconName="share24" style={{ alignSelf: "end" }}>Send</Button>
        </form>
      )}
      {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
    </div>
  );
}
