import { DeveloperPublicArticle } from "@/components/developerPublicPages";
import { PublicDocsShell } from "@/components/publicDocsShell";

export const metadata = { title: "API Changelog" };

export default function ChangelogPage() {
  return (
    <PublicDocsShell>
      <DeveloperPublicArticle
        eyebrow="Nantty Developers / Changelog"
        title="Platform changelog"
        summary="Recorded API, authentication, webhook, and Sandbox platform releases."
        items={[
          { heading: "2026-11-17 · Production Webhook Verification & Org Invite Notifications", meta: "Identity & Notifications", detail: "Added challenge ownership verification (/verify), secret rotation (/rotate-secret), AES-GCM secret custody, DNS+dial SSRF-safe signed webhook delivery worker, and transactional organization invitation emails." },
          { heading: "2026-11-16 · PKCE S256 SSO, Production Control Plane & Seller API", meta: "Auth, Gateway, Orders & Developer Portal", detail: "Added cross-domain PKCE S256 SSO, approval-gated ntlive_ credentials, /api/v1/business/{messages,conversations}, organization billing tiers, Admin Developer Ops console, and Seller zk_live_ webhooks." },
          { heading: "2026-11-16 · Isolated Sandbox Control Plane", meta: "Sandbox", detail: "Released ntsb_test_ credentials, synthetic businesses/customers, conversation simulator, deterministic scenarios, usage-preserving reset, and redacted request logs." },
        ]}
      />
    </PublicDocsShell>
  );
}
