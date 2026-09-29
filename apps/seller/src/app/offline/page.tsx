import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Offline" };

export default function OfflineFallbackPage() {
  return (
    <main id="main-content" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
      <EmptyState
        iconName="warning20"
        title="You are offline"
        description="This page needs a connection. The register keeps working offline and syncs sales when you reconnect."
        action={<ButtonLink href="/pos" variant="primary">Open the register</ButtonLink>}
      />
    </main>
  );
}
