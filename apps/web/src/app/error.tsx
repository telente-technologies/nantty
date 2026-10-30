"use client";

import { RouteErrorScreen } from "@nantty/web-kit";

import styles from "@/components/errors/errorPage.module.css";

export default function RouteErrorBoundary({ error, retry }: { readonly error: Error & { readonly digest?: string }; readonly retry: () => void }) {
  return <div className={styles.experience}><RouteErrorScreen error={error} retry={retry} /></div>;
}
