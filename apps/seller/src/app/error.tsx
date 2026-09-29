"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function RouteErrorBoundary({ reset }: { readonly error: Error & { digest?: string }; readonly reset: () => void }) {
  return (
    <main id="main-content" style={{ minHeight: "60dvh", display: "grid", placeItems: "center", padding: 16 }}>
      <EmptyState iconName="warning20" title="This page hit a problem" description="Your data is safe. Try again, and if it keeps happening, reload the page." action={<Button variant="primary" onClick={reset}>Try again</Button>} />
    </main>
  );
}
