"use client";

import { RouteErrorScreen } from "@nantty/web-kit";

import recoveryStyles from "@/components/errors/errorPage.module.css";

export default function AppRouteError({ error, retry }: { readonly error: Error & { readonly digest?: string }; readonly retry: () => void }) {
  return <div className={recoveryStyles.experience}><RouteErrorScreen error={error} retry={retry} /></div>;
}
