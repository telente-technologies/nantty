import { DeveloperPublicArticle } from "@/components/developerPublicPages";
import { PublicDocsShell } from "@/components/publicDocsShell";

export const metadata = { title: "Developer Security" };

export default function SecurityPage() {
  return (
    <PublicDocsShell>
      <DeveloperPublicArticle
        eyebrow="Nantty Developers / Security"
        title="Security & privacy architecture"
        summary="How Nantty isolates Sandbox testing, protects personal Messenger conversations, and secures production API credentials and webhooks."
        items={[
          { heading: "PKCE S256 Cross-Domain SSO", detail: "Portal logins use OAuth 2.0 Authorization Code with S256 PKCE challenges, short-lived single-use codes, and host-only HttpOnly BFF cookies." },
          { heading: "One-way Credential Digests", detail: "Both ntsb_test_ and ntlive_ API secrets are shown once at issuance and stored solely as SHA-256 digests." },
          { heading: "SSRF-Safe Verified Webhooks", detail: "Outbound webhook delivery enforces HTTPS, resolves DNS, validates public routable IPs at both validation and socket connect time (blocking RFC1918/loopback/link-local/CGNAT), disables redirects, and signs payloads with HMAC-SHA256." },
          { heading: "Personal Messaging Boundary", detail: "Personal Nantty Messenger chats remain end-to-end encrypted and inaccessible to Business Messaging API tokens." },
        ]}
      />
    </PublicDocsShell>
  );
}
