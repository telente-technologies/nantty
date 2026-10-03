"use client";

import { ErrorState } from "@zudomart/web-kit";

export default function RootRouteError({ reset }: { readonly error: Error; readonly reset: () => void }) {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "64px 16px" }}>
      <ErrorState title="Something went wrong" description="Nothing was changed. Try again." onRetry={reset} />
    </main>
  );
}
