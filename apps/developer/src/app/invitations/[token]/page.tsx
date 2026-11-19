import { DeveloperInvitationAcceptWorkspace } from "@/components/developerCatalogAndOps";
import { PortalShell } from "@/components/portalShell";

export const metadata = {
  title: "Organization invitation",
};

export default async function DeveloperInvitationPage({ params }: { readonly params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <PortalShell homeHref="/dashboard">
      <DeveloperInvitationAcceptWorkspace token={token} />
    </PortalShell>
  );
}
