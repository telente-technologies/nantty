import { DeveloperPublicArticle } from "@/components/developerPublicPages";
import { PublicDocsShell } from "@/components/publicDocsShell";

export const metadata = { title: "Pricing & Quotas" };

export default function PricingPage() {
  return (
    <PublicDocsShell>
      <DeveloperPublicArticle
        eyebrow="Nantty Developers / Pricing"
        title="Plans & monthly API quotas"
        summary="Every developer organization starts on the Sandbox tier and can switch tiers as production integrations scale."
        notice="Commercial currency pricing and automated PSP invoicing remain gated until final merchant billing rollout; monthly quota tiers are active in the control plane."
        items={[
          { heading: "Sandbox", meta: "10,000 requests / month · Free evaluation", detail: "Full access to isolated ntsb_test_ credentials, synthetic businesses and customers, conversation simulator, scenario runs, and webhook simulator." },
          { heading: "Starter", meta: "100,000 requests / month", detail: "Supports approved production applications with ntlive_ keys, verified HMAC webhooks, and organization request logs." },
          { heading: "Growth", meta: "1,000,000 requests / month", detail: "Multi-application production quotas, RBAC team governance, and automated webhook retries with dead-letter visibility." },
          { heading: "Enterprise", meta: "10,000,000 requests / month", detail: "Custom Admin-provisioned organization quota overrides and dedicated compliance review." },
        ]}
      />
    </PublicDocsShell>
  );
}
