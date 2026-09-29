import type { Metadata } from "next";

import { PromotionEditorView } from "@/components/promotions/promotionEditorView";

export const metadata: Metadata = { title: "Promotion" };

export default async function PromotionDetailPage({ params }: { readonly params: Promise<{ promotionId: string }> }) {
  const { promotionId } = await params;
  return <PromotionEditorView promotionId={promotionId} />;
}
