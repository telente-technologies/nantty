"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ProductBasicsSection } from "@/components/catalog/productBasicsSection";
import { convertDraftToUpsertRequest, convertProductToDraft, createEmptyProductDraft, regenerateVariantDraftsForOptions, type OptionDraft, type ProductDraft, type VariantDraft } from "@/components/catalog/productEditorDraft.util";
import { ProductImagesSection } from "@/components/catalog/productImagesSection";
import { ProductOptionsSection } from "@/components/catalog/productOptionsSection";
import { productStatusLabel, productStatusTone } from "@/components/catalog/productPresentation.util";
import { ProductVariantsTable } from "@/components/catalog/productVariantsTable";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { FormErrorSummary } from "@/components/ui/formFields";
import { PageHeader, PageStack } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, SellerApiRequestError, sendSellerApiRequest } from "@/services/clientApi.service";
import type { Product } from "@/types/catalog.type";
import { convertIssuesToFieldErrorMap, type ValidationIssue } from "@/utils/formValidation.util";
import { validateProductUpsertRequest } from "@/utils/productValidation.util";

import styles from "./productEditor.module.css";

export function ProductEditorView({ productId }: { readonly productId: string | null }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { settings, locations } = useStoreContext();
  const productQuery = useSellerQuery<Product>(productId ? `/seller/products/${encodeURIComponent(productId)}` : null);
  const [draft, setDraft] = useState<ProductDraft | null>(productId ? null : createEmptyProductDraft());
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const isNewProduct = productId === null;

  useEffect(() => {
    if (productQuery.data) setDraft(convertProductToDraft(productQuery.data));
  }, [productQuery.data]);

  if (productId && productQuery.errorMessage) return <Callout tone="error" title="This product could not be loaded">{productQuery.errorMessage}</Callout>;
  if (!draft || !settings) return <LoadingBlock label="Loading product" />;

  const fieldErrors = convertIssuesToFieldErrorMap(issues);
  const updateDraft = (patch: Partial<ProductDraft>) => setDraft((current) => (current ? { ...current, ...patch } : current));
  const updateOptions = (options: OptionDraft[]) => setDraft((current) => (current ? { ...current, options, variants: regenerateVariantDraftsForOptions(options, current.variants) } : current));
  const updateVariant = (variantKey: string, patch: Partial<VariantDraft>) => setDraft((current) => (current ? { ...current, variants: current.variants.map((variant) => (variant.key === variantKey ? { ...variant, ...patch } : variant)) } : current));

  async function changeOnlinePublication(publishedOnline: boolean) {
    if (isNewProduct || !productId) {
      updateDraft({ publishedOnline });
      return;
    }
    setIsPublishing(true);
    try {
      const updatedProduct = await sendSellerApiRequest<Product>(`/seller/products/${encodeURIComponent(productId)}/${publishedOnline ? "publish" : "unpublish"}`, { method: "POST", body: {} });
      updateDraft({ publishedOnline: updatedProduct.publishedOnline });
      showToast(publishedOnline ? "Published to the marketplace." : "Removed from the marketplace.");
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsPublishing(false);
    }
  }

  async function saveProduct() {
    if (!draft || !settings) return;
    const { request, parseIssues } = convertDraftToUpsertRequest(draft, settings.currency, isNewProduct);
    const clientIssues = [...parseIssues, ...validateProductUpsertRequest(request, { categoryIds: null, locationIds: locations.map((location) => location.id), skusUsedByOtherProducts: new Set(), barcodesUsedByOtherProducts: new Set() })];
    if (request.publishedOnline && draft.images.length === 0) clientIssues.push({ path: "images", message: "Add at least one photo before selling on the marketplace." });
    const uniqueIssues = clientIssues.filter((issue, index) => clientIssues.findIndex((candidate) => candidate.message === issue.message) === index);
    setIssues(uniqueIssues);
    if (uniqueIssues.length > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setIsSaving(true);
    try {
      const savedProduct = await sendSellerApiRequest<Product>(isNewProduct ? "/seller/products" : `/seller/products/${encodeURIComponent(productId ?? "")}`, { method: isNewProduct ? "POST" : "PATCH", body: request });
      showToast(isNewProduct ? `${savedProduct.name} created.` : "Changes saved.");
      if (isNewProduct) router.push(`/products/${savedProduct.id}`);
      else setDraft(convertProductToDraft(savedProduct));
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.issues && error.issues.length > 0) setIssues(error.issues);
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveProduct() {
    if (!productId || !window.confirm("Archive this product? It leaves the register and the marketplace, and you can restore it by setting it back to active.")) return;
    try {
      await sendSellerApiRequest(`/seller/products/${encodeURIComponent(productId)}`, { method: "DELETE" });
      showToast("Product archived.");
      router.push("/products");
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    }
  }

  return (
    <PageStack>
      <PageHeader
        eyebrow={<ButtonLink href="/products" variant="ghost" size="small" iconName="arrowLeft24">Products</ButtonLink>}
        title={isNewProduct ? "New product" : draft.name || "Product"}
        description={isNewProduct ? "Add it once — it sells on the register and, when published, on the Zudomart marketplace." : undefined}
        actions={!isNewProduct && productQuery.data ? <StatusBadge tone={productStatusTone[draft.status]}>{productStatusLabel[draft.status]}</StatusBadge> : null}
      />
      <FormErrorSummary messages={issues.map((issue) => issue.message)} />
      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <ProductBasicsSection draft={draft} fieldErrors={fieldErrors} onDraftChange={updateDraft} isExistingProduct={!isNewProduct} isPublishing={isPublishing} onPublishedOnlineChange={(publishedOnline) => void changeOnlinePublication(publishedOnline)} />
          <ProductOptionsSection options={draft.options} fieldErrors={fieldErrors} onOptionsChange={updateOptions} />
          <ProductVariantsTable variants={draft.variants} options={draft.options} fieldErrors={fieldErrors} isNewProduct={isNewProduct} onVariantChange={updateVariant} />
        </div>
        <div className={styles.sideColumn}>
          <ProductImagesSection images={draft.images} onUploadingChange={setIsUploading} onImagesChange={(updater) => setDraft((current) => (current ? { ...current, images: updater(current.images) } : current))} />
          {!isNewProduct ? <Callout tone="info">Stock changes go through <a href="/inventory/adjustments">stock adjustments</a> or <a href="/inventory/transfers">transfers</a> so every unit is accounted for.</Callout> : null}
        </div>
      </div>
      <div className={styles.saveBar}>
        {!isNewProduct ? <Button variant="ghost" onClick={() => void archiveProduct()} disabled={draft.status === "archived"}>Archive</Button> : null}
        <ButtonLink href="/products">Cancel</ButtonLink>
        <Button variant="primary" onClick={() => void saveProduct()} isBusy={isSaving} disabled={isUploading}>
          {isUploading ? "Waiting for photos…" : isNewProduct ? "Create product" : "Save changes"}
        </Button>
      </div>
    </PageStack>
  );
}
