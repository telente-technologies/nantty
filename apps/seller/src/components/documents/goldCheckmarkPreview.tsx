import { Callout } from "@/components/ui/feedback";
import { NanttyIcon } from "@/components/ui/nanttyIcon";
import type { BusinessDocumentsOverview } from "@/types/businessDocuments.type";

const copyByState: Record<BusinessDocumentsOverview["goldCheckmark"], string> = {
  after_approval: "The Gold checkmark comes with Pro or Business once all three documents are approved. Until then your store sells as normal without it.",
  needs_plan: "Your documents are approved. Gold shows as soon as you are on Pro or Business, or the Gold-only plan.",
  granted: "Your store shows the Gold checkmark.",
};

export function GoldCheckmarkPreview({ storeName, goldCheckmark }: { readonly storeName: string; readonly goldCheckmark: BusinessDocumentsOverview["goldCheckmark"] }) {
  return (
    <Callout tone={goldCheckmark === "granted" ? "success" : "info"} title="Preview of your Gold checkmark">
      <p style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, margin: "4px 0" }}>
        {storeName}
        <span style={{ color: "var(--gold, #b8860b)", opacity: goldCheckmark === "granted" ? 1 : 0.55, display: "inline-flex" }}><NanttyIcon name="sealCheck20" size={18} /></span>
      </p>
      {copyByState[goldCheckmark]}
    </Callout>
  );
}
