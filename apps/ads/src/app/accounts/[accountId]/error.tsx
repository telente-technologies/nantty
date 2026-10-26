"use client";

import { RouteErrorScreen } from "@nantty/web-kit";

export default function AccountRouteError({ error, retry }: { readonly error: Error & { readonly digest?: string }; readonly retry: () => void }) {
  return <RouteErrorScreen error={error} retry={retry} />;
}
