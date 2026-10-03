"use client";

import { ErrorState } from "@zudomart/web-kit";

export default function AccountRouteError({ reset }: { readonly error: Error; readonly reset: () => void }) {
  return <ErrorState title="This page didn't load" description="Something went wrong. Your campaigns are unaffected." onRetry={reset} />;
}
