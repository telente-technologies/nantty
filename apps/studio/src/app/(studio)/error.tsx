"use client";

import { ErrorState } from "@zudomart/web-kit";

export default function StudioRouteError({ reset }: { readonly error: Error; readonly reset: () => void }) {
  return <ErrorState title="This page didn't load" description="Something went wrong. Your live settings are safe." onRetry={reset} />;
}
