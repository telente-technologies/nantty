"use client";

import { RouteErrorScreen } from "@nantty/web-kit";

export default function RootRouteError({ error, retry }: { readonly error: Error & { readonly digest?: string }; readonly retry: () => void }) {
  return (
    <main id="main-content">
      <RouteErrorScreen error={error} retry={retry} />
    </main>
  );
}
