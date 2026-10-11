"use client";

import { RouteErrorScreen } from "@zudomart/web-kit";

export default function AccountRouteError({ error, retry }: { readonly error: Error & { readonly digest?: string }; readonly retry: () => void }) {
  return <RouteErrorScreen error={error} retry={retry} />;
}
