/** @jsxRuntime automatic */
/** @jsxImportSource react */
"use client";

import { defaultActionLabels, type ErrorActionIntent } from "./errorKinds";
import { ErrorLink, type ErrorExperienceConfig } from "./errorExperience.context";
import styles from "./errorState.module.css";

export interface ErrorAction {
  readonly label: string;
  readonly href?: string;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
}

export interface ActionSources {
  readonly config: ErrorExperienceConfig;
  readonly onRetry?: () => void;
  readonly retryLabel?: string;
}

function goBack(homeHref: string): void {
  if (window.history.length > 1) window.history.back();
  else window.location.assign(homeHref);
}

export function resolveErrorAction(intent: ErrorActionIntent | undefined, sources: ActionSources): ErrorAction | null {
  if (!intent) return null;
  const { config, onRetry } = sources;
  const label = (intent === "retry" ? sources.retryLabel : undefined) ?? config.labels?.[intent] ?? (intent === "home" && config.homeLabel ? config.homeLabel : defaultActionLabels[intent]);
  const handler = config.handlers?.[intent];
  const href = config.hrefs?.[intent];
  switch (intent) {
    case "retry":
    case "checkAgain":
      if (onRetry) return { label, onClick: onRetry };
      return handler ? { label, onClick: handler } : null;
    case "reload":
      return { label, onClick: handler ?? (() => window.location.reload()) };
    case "home":
      return { label, href: config.homeHref };
    case "back":
      return { label, onClick: handler ?? (() => goBack(config.homeHref)) };
    case "browse":
      return { label, href: href ?? config.homeHref };
    default:
      if (handler) return { label, onClick: handler };
      if (href) return { label, href };
      return null;
  }
}

export function ErrorActionButton({ action, emphasis }: { readonly action: ErrorAction; readonly emphasis: "primary" | "secondary" }) {
  const className = emphasis === "primary" ? styles.primaryAction : styles.secondaryAction;
  if (action.href && !action.disabled) {
    return (
      <ErrorLink href={action.href} className={className}>
        {action.label}
      </ErrorLink>
    );
  }
  return (
    <button type="button" className={className} onClick={action.onClick} disabled={action.disabled} aria-disabled={action.disabled || undefined}>
      {action.label}
    </button>
  );
}
