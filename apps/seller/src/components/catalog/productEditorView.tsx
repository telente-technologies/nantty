"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { requestConfirmation } from "@zudomart/web-kit";

import { ProductAttributesSection } from "@/components/catalog/productAttributesSection";
import { ProductBasicsSection } from "@/components/catalog/productBasicsSection";
import { ProductBrandSection } from "@/components/catalog/productBrandSection";
import { convertDraftToUpsertRequest, convertProductToDraft, createEmptyProductDraft, regenerateVariantDraftsForOptions, type OptionDraft, type ProductDraft, type VariantDraft } from "@/components/catalog/productEditorDraft.util";
import { ProductImagesSection } from "@/components/catalog/productImagesSection";
import { ProductOptionsSection } from "@/components/catalog/productOptionsSection";
import { describeProductPublicationState } from "@/components/catalog/productPresentation.util";
import { ProductRegionalPricesSection } from "@/components/catalog/productRegionalPricesSection";
import { ProductPublishingSection } from "@/components/catalog/productPublishingSection";
import { ProductSupplierSection } from "@/components/catalog/productSupplierSection";
import { ProductVariantsTable } from "@/components/catalog/productVariantsTable";
import { ProductVideosSection } from "@/components/catalog/productVideosSection";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { FormErrorSummary } from "@/components/ui/formFields";
import { PageHeader, PageStack } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, SellerApiRequestError, sendSellerApiRequest } from "@/services/clientApi.service";
import { presentPaymentProblem } from "@/utils/paymentProblem.util";
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
  const saveInFlight = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const isNewProduct = productId === null;

  useEffect(() => {
    if (productQuery.data) setDraft(convertProductToDraft(productQuery.data));
  }, [productQuery.data]);

  if (productId && productQuery.errorMessage) return <ErrorCallout variant="section" title="This product could not be loaded" error={productQuery.error} message={productQuery.errorMessage} onRetry={productQuery.reload} />;
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
      if (await presentPaymentProblem(error)) return;
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsPublishing(false);
    }
  }

  async function duplicateProduct() {
    if (!productId) return;
    setIsDuplicating(true);
    try {
      const copy = await sendSellerApiRequest<Product>(`/seller/products/${encodeURIComponent(productId)}/duplicate`, { method: "POST", body: {} });
      showToast("Copied as a draft with new SKUs and no stock. Review it before publishing.");
      router.push(`/products/${copy.id}`);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsDuplicating(false);
    }
  }

  async function saveProduct(saveAsDraft = false) {
    if (!draft || !settings || saveInFlight.current) return;
    const draftToSave = saveAsDraft ? { ...draft, status: "draft" as const, publishedOnline: false } : draft;
    if (saveAsDraft) setDraft(draftToSave);
    const { request, parseIssues } = convertDraftToUpsertRequest(draftToSave, settings.currency, isNewProduct);
    const clientIssues = [...parseIssues, ...validateProductUpsertRequest(request, { categoryIds: null, locationIds: locations.map((location) => location.id), skusUsedByOtherProducts: new Set(), barcodesUsedByOtherProducts: new Set() })];
    if (request.publishedOnline && draftToSave.images.length === 0) clientIssues.push({ path: "images", message: "Add at least one photo before selling on the marketplace." });
    const uniqueIssues = clientIssues.filter((issue, index) => clientIssues.findIndex((candidate) => candidate.message === issue.message) === index);
    setIssues(uniqueIssues);
    if (uniqueIssues.length > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setIsSaving(true);
    saveInFlight.current = true;
    try {
      const savedProduct = await sendSellerApiRequest<Product>(isNewProduct ? "/seller/products" : `/seller/products/${encodeURIComponent(productId ?? "")}`, { method: isNewProduct ? "POST" : "PATCH", body: request });
      showToast(saveAsDraft ? "Saved as a draft." : isNewProduct ? `${savedProduct.name} created.` : "Changes saved.");
      if (isNewProduct) router.push(`/products/${savedProduct.id}`);
      else setDraft(convertProductToDraft(savedProduct));
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.issues && error.issues.length > 0) setIssues(error.issues);
      if (await presentPaymentProblem(error)) return;
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
    }
  }

  async function archiveProduct() {
    if (!productId || !(await requestConfirmation({ title: "Archive this product?", description: "It is removed from the marketplace. You can restore it by setting it back to active.", confirmLabel: "Archive", intent: "archive" }))) return;
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
        description={isNewProduct ? "Add it once. When it is active and listed, customers can buy it in the Zudomart app." : undefined}
        actions={!isNewProduct && productQuery.data ? (
          <>
            <StatusBadge tone={describeProductPublicationState(productQuery.data).tone}>{describeProductPublicationState(productQuery.data).label}</StatusBadge>
            <Button size="small" iconName="copy16" isBusy={isDuplicating} onClick={() => void duplicateProduct()}>Duplicate</Button>
          </>
        ) : null}
      />
      <FormErrorSummary messages={issues.map((issue) => issue.message)} />
      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <ProductBasicsSection draft={draft} fieldErrors={fieldErrors} onDraftChange={updateDraft} />
          <ProductOptionsSection options={draft.options} fieldErrors={fieldErrors} onOptionsChange={updateOptions} />
          <ProductVariantsTable variants={draft.variants} options={draft.options} fieldErrors={fieldErrors} isNewProduct={isNewProduct} onVariantChange={updateVariant} />
          <ProductRegionalPricesSection variants={draft.variants} options={draft.options} fieldErrors={fieldErrors} onVariantChange={updateVariant} />
          <ProductAttributesSection attributes={draft.attributes} fieldErrors={fieldErrors} onAttributesChange={(attributes) => updateDraft({ attributes })} />
        </div>
        <div className={styles.sideColumn}>
          <ProductPublishingSection draft={draft} fieldErrors={fieldErrors} onDraftChange={updateDraft} isPublishing={isPublishing} onPublishedOnlineChange={(publishedOnline) => void changeOnlinePublication(publishedOnline)} />
          <ProductImagesSection images={draft.images} onUploadingChange={setIsUploading} onImagesChange={(updater) => setDraft((current) => (current ? { ...current, images: updater(current.images) } : current))} />
          <ProductVideosSection videos={draft.videos} fieldErrors={fieldErrors} onVideosChange={(videos) => updateDraft({ videos })} />
          <ProductBrandSection draft={draft} fieldErrors={fieldErrors} onDraftChange={updateDraft} />
          <ProductSupplierSection draft={draft} fieldErrors={fieldErrors} onDraftChange={updateDraft} />
          {!isNewProduct ? <Callout tone="info">Stock changes go through <a href="/inventory/adjustments">stock adjustments</a> or <a href="/inventory/transfers">transfers</a> so every unit is accounted for.</Callout> : null}
        </div>
      </div>
      <div className={styles.saveBar}>
        {!isNewProduct ? <Button variant="ghost" onClick={() => void archiveProduct()} disabled={draft.status === "archived"}>Archive</Button> : null}
        <ButtonLink href="/products">Cancel</ButtonLink>
        {draft.status !== "draft" || isNewProduct ? <Button onClick={() => void saveProduct(true)} disabled={isSaving || isUploading}>Save as draft</Button> : null}
        <Button variant="primary" onClick={() => void saveProduct()} isBusy={isSaving} disabled={isUploading}>
          {isUploading ? "Waiting for photos…" : isNewProduct ? "Create product" : "Save changes"}
        </Button>
      </div>
    </PageStack>
  );
}
