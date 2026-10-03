"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/formFields";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import { triggerBrowserDownload } from "@/utils/csvFile.util";

export function ProductExportPanel() {
  const { showToast } = useToast();
  const { locations } = useStoreContext();
  const [stockLocationId, setStockLocationId] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  async function downloadProductsAsCsv() {
    setIsExporting(true);
    try {
      const csvBlob = await sendSellerApiRequest<Blob>("/seller/products/export", { query: { locationId: stockLocationId || undefined }, expect: "blob" });
      triggerBrowserDownload(`products-${new Date().toISOString().slice(0, 10)}.csv`, csvBlob);
      showToast("Your product CSV is downloading.");
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Panel title="Export products" description="Every active and draft product, one row per variant, in the same columns the import uses. Open it in Excel or Google Sheets, edit, and import it back." actions={<Button variant="primary" iconName="boxArrowDown24" onClick={() => void downloadProductsAsCsv()} isBusy={isExporting}>Download CSV</Button>}>
      <SelectField label="Stock column shows" value={stockLocationId} onChange={(event) => setStockLocationId(event.target.value)} options={[{ value: "", label: "All locations added up" }, ...locations.map((location) => ({ value: location.id, label: location.name }))]} />
    </Panel>
  );
}
