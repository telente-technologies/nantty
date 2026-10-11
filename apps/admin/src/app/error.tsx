"use client";

import { ErrorState } from "@zudomart/web-kit";

export default function RootRouteError({ error, reset }: { readonly error: Error & { readonly digest?: string }; readonly reset: () => void }) {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "64px 16px" }}>
      <ErrorState title="This page failed to load" description={`Nothing was changed. Try again, and quote this reference if it repeats: ${error.digest ?? "CLIENT_RENDER_ERROR"}.`} onRetry={reset} />
    </main>
  );
}
