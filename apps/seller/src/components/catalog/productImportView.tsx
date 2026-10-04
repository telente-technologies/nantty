"use client";

import { useMemo, useState, type ChangeEvent } from "react";

import { buildImportRowsFromCsv, findImportRowProblems, guessColumnMappingFromHeaders, type ColumnMapping } from "@/components/catalog/productImportMapping.util";
import { PlanGate } from "@/components/billing/planGate";
import { ProductExportPanel } from "@/components/catalog/productExportPanel";
import { ProductImportResultPanel } from "@/components/catalog/productImportResultPanel";
import { ProductsSectionTabs } from "@/components/catalog/productsSectionTabs";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { productCsvColumns } from "@/constants/productCsvColumns.constant";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { createIdempotencyKey, readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { ProductImportResult } from "@/types/productRequests.type";
import { convertRowsToCsvText, parseCsvText, triggerBrowserDownload } from "@/utils/csvFile.util";

const maximumCsvBytes = 2 * 1024 * 1024;
const maximumRows = 2000;

export function ProductImportView() {
  const { settings, locations, selectedLocationId } = useStoreContext();
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [locationId, setLocationId] = useState<string>("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ProductImportResult | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey("import"));
  const chosenLocationId = locationId || selectedLocationId || locations[0]?.id || "";

  const previewRows = useMemo(() => {
    if (!mapping || !settings) return [];
    return buildImportRowsFromCsv(dataRows, mapping).map((row) => ({ row, problems: findImportRowProblems(row, settings.currency) }));
  }, [dataRows, mapping, settings]);
  const validRows = previewRows.filter((entry) => entry.problems.length === 0).map((entry) => entry.row);

  async function readChosenCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setResult(null);
    setFileError(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") return setFileError("Choose a .csv file.");
    if (file.size > maximumCsvBytes) return setFileError("CSV files must be 2 MB or smaller. Split larger catalogs into several files.");
    const parsedRows = parseCsvText((await file.text()).replace(/^\uFEFF/, ""));
    const [headerRow, ...rows] = parsedRows;
    if (!headerRow || rows.length === 0) return setFileError("The file needs a header row and at least one product row.");
    if (rows.length > maximumRows) return setFileError(`Import up to ${maximumRows} rows at a time.`);
    setFileName(file.name);
    setHeaders(headerRow);
    setDataRows(rows);
    setMapping(guessColumnMappingFromHeaders(headerRow));
    setIdempotencyKey(createIdempotencyKey("import"));
  }

  async function importValidRows() {
    setIsImporting(true);
    setSubmitError(null);
    try {
      setResult(await sendSellerApiRequest<ProductImportResult>("/seller/products/import", { method: "POST", body: { locationId: chosenLocationId, rows: validRows }, idempotencyKey }));
    } catch (error) {
      setSubmitError(readErrorMessageForDisplay(error));
    } finally {
      setIsImporting(false);
    }
  }

  function downloadTemplateCsv() {
    triggerBrowserDownload("zudomart-products-template.csv", convertRowsToCsvText(productCsvColumns.map((column) => column.header), [productCsvColumns.map((column) => column.example)]));
  }

  const missingRequiredFields = mapping ? productCsvColumns.filter((column) => column.required && mapping[column.field] === null) : [];

  return (
    <PageStack>
      <PageHeader eyebrow={<ButtonLink href="/products" variant="ghost" size="small" iconName="arrowLeft24">Products</ButtonLink>} title="Import & export" description="Create new products or update prices of existing SKUs from a spreadsheet. Rows with a matching SKU are updated; new names become new products, one row per variant." />
      <ProductsSectionTabs />
      <PlanGate feature="bulk_tools" description="Import and export your whole catalog as a spreadsheet. On Free you can still add and edit products one at a time.">
      <ProductExportPanel />
      <Panel title="1. Choose a CSV file" actions={<Button size="small" iconName="boxArrowDown24" onClick={downloadTemplateCsv}>Download template</Button>}>
        <input type="file" accept=".csv,text/csv" onChange={(event) => void readChosenCsvFile(event)} aria-label="CSV file" />
        {fileName ? <p style={{ marginTop: 8 }}>{fileName}: {dataRows.length} rows</p> : null}
        {fileError ? <div style={{ marginTop: 10 }}><Callout tone="error">{fileError}</Callout></div> : null}
      </Panel>
      {mapping ? (
        <Panel title="2. Match your columns" description={`Prices are read in ${settings?.currency ?? "your store currency"}. Opening stock goes to the location you pick.`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            <SelectField label="Opening stock location" value={chosenLocationId} onChange={(event) => setLocationId(event.target.value)} options={locations.map((location) => ({ value: location.id, label: location.name }))} />
            {productCsvColumns.map((column) => (
              <SelectField key={column.field} label={`${column.header}${column.required ? " (required)" : ""}`} value={mapping[column.field] === null ? "" : String(mapping[column.field])} onChange={(event) => setMapping({ ...mapping, [column.field]: event.target.value === "" ? null : Number(event.target.value) })} options={[{ value: "", label: "Not in file" }, ...headers.map((header, index) => ({ value: String(index), label: header || `Column ${index + 1}` }))]} />
            ))}
          </div>
          {missingRequiredFields.length > 0 ? <div style={{ marginTop: 12 }}><Callout tone="caution">Match these required columns: {missingRequiredFields.map((column) => column.header).join(", ")}.</Callout></div> : null}
        </Panel>
      ) : null}
      {mapping && missingRequiredFields.length === 0 ? (
        <Panel title="3. Check and import" description={`${validRows.length} of ${previewRows.length} rows are ready. Rows with problems are skipped.`} actions={<Button variant="primary" onClick={() => void importValidRows()} isBusy={isImporting} disabled={validRows.length === 0 || result !== null}>Import {validRows.length} rows</Button>} padded={false}>
          {submitError ? <div style={{ padding: 12 }}><Callout tone="error">{submitError}</Callout></div> : null}
          <div style={{ overflowX: "auto", maxHeight: 420 }}>
            <table style={{ fontSize: 13 }}>
              <thead><tr>{["Row", "Product", "SKU", "Price", "Status"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: 8, background: "var(--surface-sunken)" }}>{heading}</th>)}</tr></thead>
              <tbody>
                {previewRows.slice(0, 300).map(({ row, problems }) => (
                  <tr key={row.rowNumber} style={{ borderBottom: "1px solid var(--divider-soft)" }}>
                    <td style={{ padding: 8 }}>{row.rowNumber}</td>
                    <td style={{ padding: 8 }}>{row.productName}{row.option1Value ? ` · ${[row.option1Value, row.option2Value].filter(Boolean).join(" / ")}` : ""}</td>
                    <td style={{ padding: 8 }}>{row.sku}</td>
                    <td style={{ padding: 8 }}>{row.price}</td>
                    <td style={{ padding: 8 }}>{problems.length === 0 ? <StatusBadge tone="success">Ready</StatusBadge> : <span style={{ color: "var(--error-ink)" }}>{problems.join(" ")}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
      {result ? <ProductImportResultPanel result={result} /> : null}
      </PlanGate>
    </PageStack>
  );
}
