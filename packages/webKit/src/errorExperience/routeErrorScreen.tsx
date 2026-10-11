/** @jsxRuntime automatic */
/** @jsxImportSource react */
"use client";

import { useEffect } from "react";

import { ErrorExperienceProvider, useErrorExperience, type ErrorExperienceConfig } from "./errorExperience.context";
import { resolveErrorKind } from "./errorMapper";
import { readErrorSignal } from "./errorSignal";
import { ErrorState, type ErrorStateVariant } from "./errorState";

export interface RouteErrorScreenProps {
  readonly error: Error & { readonly digest?: string };
  readonly retry?: () => void;
  readonly variant?: ErrorStateVariant;
}

export function RouteErrorScreen({ error, retry, variant = "page" }: RouteErrorScreenProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const signal = readErrorSignal(error);
  const resolved = resolveErrorKind(signal);
  const kind = resolved.kind === "unknown" && signal.status === undefined ? "serverError" : undefined;
  return <ErrorState error={error} kind={kind} variant={variant} onRetry={retry} />;
}

export function GlobalErrorScreen({ error, retry, config }: RouteErrorScreenProps & { readonly config?: ErrorExperienceConfig }) {
  const inherited = useErrorExperience();
  return (
    <ErrorExperienceProvider value={config ?? inherited}>
      <main style={{ display: "grid", placeItems: "center", minHeight: "100dvh", background: "var(--color-bg)", color: "var(--color-text)" }}>
        <RouteErrorScreen error={error} retry={retry} />
      </main>
    </ErrorExperienceProvider>
  );
}
