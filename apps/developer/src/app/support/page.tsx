import { DeveloperPublicArticle } from "@/components/developerPublicPages";
import { PublicDocsShell } from "@/components/publicDocsShell";

export const metadata = { title: "Developer Support" };

export default function SupportPage() {
  return (
    <PublicDocsShell>
      <DeveloperPublicArticle
        eyebrow="Nantty Developers / Support"
        title="Developer support & incident reporting"
        summary="Get help with Sandbox onboarding, application reviews, webhook verification, or production quota inquiries."
        items={[
          { heading: "Include request & organization context", detail: "Share your organization ID, application ID, environment (Sandbox or Production), and X-Request-Id header. Never paste ntsb_test_, ntlive_, or whsec_ secrets into support tickets." },
          { heading: "Application production reviews", detail: "Administrators review submitted applications from the Nantty Admin Developer Ops console. Status updates and quota overrides apply immediately upon approval." },
        ]}
      />
    </PublicDocsShell>
  );
}
