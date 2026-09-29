import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/authCard";
import { readAdminDeploymentEnvironment } from "@/config/adminEnvironment.config";

export const metadata: Metadata = { title: "Network not allowed" };

export default function RestrictedNetworkPage() {
  return (
    <AuthCard environment={readAdminDeploymentEnvironment()} title="This network can't reach the admin console" description="The admin console only accepts connections from approved office and VPN addresses.">
      <p>Connect to the Zudomart VPN and reload this page. If you are already connected, email oyinlola.tech@icloud.com or oluwayemioyinlola2@icloud.com to check the IP allow-list.</p>
    </AuthCard>
  );
}
