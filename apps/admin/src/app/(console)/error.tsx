"use client";

import { ErrorBlock } from "@/components/ui/feedback";

export default function ConsoleError({ error, reset }: { readonly error: Error & { readonly digest?: string }; readonly reset: () => void }) {
  return <ErrorBlock message={`This page failed to render. Nothing was changed. Reference: ${error.digest ?? "CLIENT_RENDER_ERROR"}.`} onRetry={reset} />;
}
