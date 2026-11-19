import { DeveloperPublicArticle } from "@/components/developerPublicPages";
import { PublicDocsShell } from "@/components/publicDocsShell";

export const metadata = { title: "Acceptable Use Policy" };

export default function AcceptableUsePage() {
  return (
    <PublicDocsShell>
      <DeveloperPublicArticle
        eyebrow="Nantty Developers / Legal"
        title="API Acceptable Use Policy (Preview)"
        summary="Permitted and prohibited uses across Nantty Sandbox and Production Business Messaging APIs."
        notice="Legal notice: Pre-launch acceptable use policy pending final counsel publication."
        items={[
          { heading: "Prohibited targeting & bypass", detail: "Never attempt to bypass environment isolation, probe internal network addresses via webhooks, or access personal conversations outside consented business grants." },
          { heading: "Child safety & platform integrity", detail: "Integrations must comply with Nantty Community Guidelines and applicable safety laws; abusive applications are permanently terminated." },
        ]}
      />
    </PublicDocsShell>
  );
}
