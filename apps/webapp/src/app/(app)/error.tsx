"use client";

import { ErrorState } from "@/components/ui/feedback";

export default function AppRouteError({ reset }: { readonly error: Error; readonly reset: () => void }) {
  return <ErrorState title="This page didn't load" description="Something went wrong on our side. Your data is safe." onRetry={reset} />;
}
