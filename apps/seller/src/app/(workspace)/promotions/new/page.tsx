import type { Metadata } from "next";

import { PromotionEditorView } from "@/components/promotions/promotionEditorView";

export const metadata: Metadata = { title: "New promotion" };

export default function NewPromotionPage() {
  return <PromotionEditorView promotionId={null} />;
}
