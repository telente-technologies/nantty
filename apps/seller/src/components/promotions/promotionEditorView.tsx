"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PromotionEditorForm } from "@/components/promotions/promotionEditorForm";
import { promotionStatusLabel, promotionStatusTone } from "@/components/promotions/promotionPresentation.util";
import { Button } from "@/components/ui/button";
import { ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { ModalDialog } from "@/components/ui/modalDialog";
import { PageHeader, PageStack } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { Promotion } from "@/types/promotion.type";
import type { PromotionInput } from "@/utils/promotionValidation.util";
import { IconLabel } from "@/components/ui/zudoIcon";

export function PromotionEditorView({ promotionId }: { readonly promotionId: string | null }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { settings } = useStoreContext();
  const promotionQuery = useSellerQuery<Promotion>(promotionId ? `/seller/promotions/${encodeURIComponent(promotionId)}` : null);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const promotion = promotionQuery.data;

  if (!settings || (promotionId && promotionQuery.isLoading && !promotion)) return <LoadingBlock label="Loading promotion" />;
  if (promotionId && !promotion) return <ErrorCallout variant="section" error={promotionQuery.error} message={promotionQuery.errorMessage ?? "This promotion could not be loaded."} onRetry={promotionQuery.reload} />;

  async function savePromotion(input: PromotionInput) {
    setIsSaving(true);
    try {
      const saved = promotion
        ? await sendSellerApiRequest<Promotion>(`/seller/promotions/${promotion.id}`, { method: "PATCH", body: input })
        : await sendSellerApiRequest<Promotion>("/seller/promotions", { method: "POST", body: input });
      showToast(promotion ? "Promotion saved." : `${saved.name} created.`);
      if (promotion) promotionQuery.replaceData(() => saved);
      else router.push(`/promotions/${saved.id}`);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function switchPromotionOnOrOff(nextStatus: "active" | "disabled") {
    if (!promotion) return;
    setIsChangingStatus(true);
    try {
      const updated = await sendSellerApiRequest<Promotion>(`/seller/promotions/${promotion.id}`, { method: "PATCH", body: { status: nextStatus } });
      promotionQuery.replaceData(() => updated);
      showToast(nextStatus === "disabled" ? "Promotion switched off." : "Promotion switched on.");
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsChangingStatus(false);
    }
  }

  async function deletePromotion() {
    if (!promotion) return;
    try {
      await sendSellerApiRequest(`/seller/promotions/${promotion.id}`, { method: "DELETE" });
      showToast("Promotion deleted.");
      router.push("/marketing/discounts");
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    }
  }

  return (
    <PageStack>
      <PageHeader
        eyebrow={<Link href="/marketing/discounts"><IconLabel name="arrowLeft24" size={16}>Discounts</IconLabel></Link>}
        title={promotion ? promotion.name : "New promotion"}
        description={promotion ? `Used ${promotion.usedCount.toLocaleString()} times` : "Discounts use your store's currency and apply before tax."}
        actions={
          promotion ? (
            <>
              <StatusBadge tone={promotionStatusTone[promotion.status]}>{promotionStatusLabel[promotion.status]}</StatusBadge>
              <Button size="small" isBusy={isChangingStatus} onClick={() => void switchPromotionOnOrOff(promotion.status === "disabled" ? "active" : "disabled")}>
                {promotion.status === "disabled" ? "Switch on" : "Switch off"}
              </Button>
              <Button size="small" variant="ghost" iconName="trash24" onClick={() => setIsDeleteDialogOpen(true)}>Delete</Button>
            </>
          ) : null
        }
      />
      <PromotionEditorForm key={promotion?.id ?? "new"} promotion={promotion} currency={settings.currency} isSaving={isSaving} onSubmit={(input) => void savePromotion(input)} />
      <ModalDialog intent="delete"
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        title="Delete this promotion?"
        description="Customers can no longer use it. Past orders keep their discount."
        width="small"
        footer={
          <>
            <Button onClick={() => setIsDeleteDialogOpen(false)}>Keep it</Button>
            <Button variant="danger" onClick={() => void deletePromotion()}>Delete promotion</Button>
          </>
        }
      >
        <p>{promotion?.name}</p>
      </ModalDialog>
    </PageStack>
  );
}
