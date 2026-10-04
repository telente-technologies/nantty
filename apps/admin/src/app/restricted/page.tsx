import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/authCard";
import { readAdminDeploymentEnvironment } from "@/config/adminEnvironment.config";
import { adminSupportContactEmails } from "@/constants/supportContacts.constant";

export const metadata: Metadata = { title: "Network not allowed" };

export default function RestrictedNetworkPage() {
  return (
    <AuthCard environment={readAdminDeploymentEnvironment()} title="This network can't reach the admin console" description="The admin console only accepts connections from approved office and VPN addresses.">
      <p>Connect to the Zudomart VPN and reload this page. If you are already connected, email <a href={`mailto:${adminSupportContactEmails[0]}`}>{adminSupportContactEmails[0]}</a> to check the IP allow-list.</p>
    </AuthCard>
  );
}
