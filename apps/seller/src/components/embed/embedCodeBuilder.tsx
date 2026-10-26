"use client";

import { buildEmbedFrameUrl, buildEmbedSnippet, embedPreviewSandbox, type EmbedSnippetKind, type EmbedSnippetLayout, type EmbedSnippetSize, type EmbedSnippetTheme } from "@nantty/web-kit";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { CheckboxField, SelectField } from "@/components/ui/formFields";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { useCursorPagedList } from "@/hooks/useCursorPagedList.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { Product } from "@/types/catalog.type";

import styles from "./embedCodeBuilder.module.css";

const embedOrigin = (process.env.NEXT_PUBLIC_WEBAPP_URL ?? "https://web.nantty.com").replace(/\/+$/, "");
const kindOptions: readonly { readonly value: EmbedSnippetKind; readonly label: string }[] = [
  { value: "store", label: "Store card" }, { value: "products", label: "Products" }, { value: "button", label: "Buy button" },
];
const maximumSelectedProducts = 12;

export function EmbedCodeBuilder() {
  const { settings } = useStoreContext();
  const { showToast } = useToast();
  const [kind, setKind] = useState<EmbedSnippetKind>("store");
  const [theme, setTheme] = useState<EmbedSnippetTheme>("light");
  const [size, setSize] = useState<EmbedSnippetSize>("medium");
  const [layout, setLayout] = useState<EmbedSnippetLayout>("grid");
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const products = useCursorPagedList<Product>("/seller/products", { status: "active", limit: 50 });
  const embeddableProducts = useMemo(() => (products.items ?? []).filter((product) => product.status === "active" && product.publishedOnline), [products.items]);

  if (settings === null) return <LoadingBlock label="Loading your store" />;
  const productId = selectedIds[0];
  const options = { origin: embedOrigin, kind, storeId: settings.storeId, productId, theme, layout, size, productIds: kind === "products" ? selectedIds : undefined };
  const needsProduct = kind === "button" && productId === undefined;
  const snippet = buildEmbedSnippet(options);

  function toggleProduct(id: string, checked: boolean) {
    setSelectedIds((current) => {
      if (kind === "button") return checked ? [id] : [];
      const next = checked ? [...current.filter((value) => value !== id), id] : current.filter((value) => value !== id);
      return next.slice(0, maximumSelectedProducts);
    });
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      showToast("Embed code copied. Paste it into your website's HTML.");
    } catch {
      showToast("Couldn't copy. Select the code and copy it manually.", "error");
    }
  }

  return (
    <PageStack>
      <PageHeader title="Embed on your site" description="Show your store, products or a Buy on Nantty button on your own website. Buying always opens Nantty, so payments stay protected." />
      <div className={styles.layout}>
        <div className={styles.controls}>
          <Panel title="What to show">
            <div className={styles.choices}>
              {kindOptions.map((option) => (
                <Button key={option.value} variant={kind === option.value ? "primary" : "secondary"} size="small" onClick={() => { setKind(option.value); setSelectedIds([]); }}>{option.label}</Button>
              ))}
            </div>
          </Panel>
          <Panel title="Look">
            <SelectField label="Theme" value={theme} onChange={(event) => setTheme(event.target.value as EmbedSnippetTheme)} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
            {kind !== "button" ? <SelectField label="Size" value={size} onChange={(event) => setSize(event.target.value as EmbedSnippetSize)} options={[{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }]} /> : null}
            {kind === "products" ? <SelectField label="Layout" value={layout} onChange={(event) => setLayout(event.target.value as EmbedSnippetLayout)} options={[{ value: "grid", label: "Grid" }, { value: "carousel", label: "Carousel" }]} /> : null}
          </Panel>
          {kind !== "store" ? (
            <Panel title={kind === "button" ? "Product" : "Products (optional)"} description={kind === "button" ? "Pick the product the button sells." : "Leave empty to show your newest in-stock products."}>
              {products.isLoading ? <LoadingBlock rows={2} /> : embeddableProducts.length === 0 ? <Callout>Publish a product online to embed it.</Callout> : (
                <div className={styles.productList}>
                  {embeddableProducts.map((product) => (
                    <CheckboxField key={product.id} label={product.name} checked={selectedIds.includes(product.id)} onCheckedChange={(checked) => toggleProduct(product.id, checked)} />
                  ))}
                </div>
              )}
            </Panel>
          ) : null}
          <Panel title="Embed code" actions={<Button variant="primary" iconName="copy16" onClick={copySnippet} disabled={needsProduct}>Copy code</Button>}>
            {needsProduct ? <Callout tone="caution">Pick a product first.</Callout> : <pre className={styles.code}>{snippet}</pre>}
          </Panel>
        </div>
        <Panel title="Live preview" description="Suspended stores and hidden or sold-out products never show to buyers.">
          {needsProduct ? <Callout>Pick a product to preview the button.</Callout> : (
            <iframe key={buildEmbedFrameUrl(options)} className={styles.preview} src={buildEmbedFrameUrl(options)} sandbox={embedPreviewSandbox} title="Embed preview" referrerPolicy="strict-origin-when-cross-origin" />
          )}
        </Panel>
      </div>
    </PageStack>
  );
}
