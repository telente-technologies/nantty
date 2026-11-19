import { DeveloperPublicArticle } from "@/components/developerPublicPages";
import { PublicDocsShell } from "@/components/publicDocsShell";

export const metadata = { title: "Developer Terms" };

export default function DeveloperTermsPage() {
  return (
    <PublicDocsShell>
      <DeveloperPublicArticle
        eyebrow="Nantty Developers / Legal"
        title="Nantty Developer Terms (Preview)"
        summary="Summary of developer platform obligations covering credential custody, business consent, and quota compliance."
        notice="Legal notice: These developer terms are a pre-launch summary pending final counsel sign-off. Production onboarding requires explicit administrative review."
        items={[
          { heading: "1. Credential & secret custody", detail: "You must keep ntsb_test_, ntlive_, and whsec_ secrets confidential, rotate compromised secrets immediately, and never embed server credentials in client apps." },
          { heading: "2. Customer consent & anti-spam", detail: "Production Business Messaging requires explicit customer consent and business authorization. Unsolicited bulk messaging is prohibited." },
          { heading: "3. Suspension & revocation", detail: "Nantty may suspend applications or revoke credentials that violate rate limits, attempt SSRF/unauthorized access, or misuse customer data." },
        ]}
      />
    </PublicDocsShell>
  );
}
