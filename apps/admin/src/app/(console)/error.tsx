"use client";

import { ErrorBlock } from "@/components/ui/feedback";

export default function ConsoleError({ reset }: { readonly error: Error; readonly reset: () => void }) {
  return <ErrorBlock message="This page hit an unexpected error. Nothing was changed." onRetry={reset} />;
}
