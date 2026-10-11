/** @jsxRuntime automatic */
/** @jsxImportSource react */
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { useIsOnline, useOnReconnect } from "../network/useIsOnline";
import { ErrorActionButton, resolveErrorAction, type ErrorAction } from "./errorActions";
import { useErrorExperience } from "./errorExperience.context";
import { ErrorIcon } from "./errorIcons";
import type { ErrorDescriptor, ErrorKind, ErrorSubject } from "./errorKinds";
import { describeErrorSignal } from "./errorMapper";
import { ErrorReference } from "./errorReference";
import { readErrorSignal } from "./errorSignal";
import styles from "./errorState.module.css";
import { formatCountdownClock } from "./retryCountdown";
import { useRetryCountdown } from "./useRetryCountdown";
import { probeConnectivity } from "./connectivity";

export type ErrorStateVariant = "page" | "section" | "inline" | "compact";

export interface ErrorStateProps {
  readonly error?: unknown;
  readonly kind?: ErrorKind;
  readonly subject?: ErrorSubject;
  readonly variant?: ErrorStateVariant;
  readonly title?: string;
  readonly description?: string;
  readonly onRetry?: () => void;
  readonly retryLabel?: string;
  readonly action?: ReactNode;
  readonly primaryAction?: ErrorAction;
  readonly secondaryAction?: ErrorAction;
  readonly hideActions?: boolean;
  readonly reference?: string;
  readonly code?: string;
  readonly focusOnMount?: boolean;
  readonly children?: ReactNode;
}

const genericKinds = new Set<ErrorKind>(["unknown", "serverError", "timeout"]);
const connectionSensitiveKinds = new Set<ErrorKind>(["unknown", "serverError", "timeout", "maintenance", "offline", "mediaFailed", "uploadFailed"]);

export function useErrorDescriptor(props: Pick<ErrorStateProps, "error" | "kind" | "subject" | "reference" | "code">): ErrorDescriptor {
  const config = useErrorExperience();
  const isOnline = useIsOnline();
  const signal = readErrorSignal(props.error);
  const descriptor = describeErrorSignal({ ...signal, code: signal.code ?? props.code, requestId: props.reference ?? signal.requestId }, { kind: props.kind, subject: props.subject, describePermission: config.describePermission });
  if (!isOnline && connectionSensitiveKinds.has(descriptor.kind) && descriptor.kind !== "offline") return describeErrorSignal({ status: 0, code: "NETWORK_UNAVAILABLE", requestId: descriptor.reference }, {});
  return descriptor;
}

export function ErrorState(props: ErrorStateProps) {
  const { variant = "section", onRetry, hideActions, action, children } = props;
  const config = useErrorExperience();
  const descriptor = useErrorDescriptor(props);
  const useCallerCopy = props.kind !== undefined || genericKinds.has(descriptor.kind);
  const title = (useCallerCopy ? props.title : undefined) ?? descriptor.title;
  const description = (useCallerCopy ? props.description : undefined) ?? descriptor.description;
  const secondsLeft = useRetryCountdown(descriptor.retryAfterSeconds);
  const [reconnected, setReconnected] = useState(false);
  const [checking, setChecking] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const shouldFocus = props.focusOnMount ?? variant === "page";

  useEffect(() => {
    if (shouldFocus) titleRef.current?.focus({ preventScroll: false });
  }, [shouldFocus, descriptor.kind]);

  useOnReconnect(() => {
    if (descriptor.kind !== "offline") return;
    setReconnected(true);
    onRetry?.();
  });

  const checkAgain = onRetry
    ? async () => {
        setChecking(true);
        const reachable = await probeConnectivity(config.connectivityProbeUrl);
        setChecking(false);
        if (reachable) onRetry();
      }
    : undefined;
  const sources = { config, onRetry: descriptor.kind === "offline" && checkAgain ? () => void checkAgain() : onRetry, retryLabel: props.retryLabel };
  let primary = props.primaryAction ?? resolveErrorAction(descriptor.primary, sources) ?? resolveErrorAction("retry", sources) ?? (variant === "page" ? resolveErrorAction("home", sources) : null);
  const secondary = props.secondaryAction ?? (variant === "page" && !action ? resolveErrorAction(descriptor.secondary, sources) : null);
  if (primary && descriptor.kind === "rateLimited" && secondsLeft > 0 && primary.onClick) primary = { ...primary, label: `Try again in ${formatCountdownClock(secondsLeft)}`, disabled: true };
  if (primary && checking) primary = { ...primary, label: "Checking…", disabled: true };
  const showSecondary = secondary && secondary.label !== primary?.label && variant !== "inline";
  const HeadingTag = variant === "page" ? "h1" : variant === "inline" ? "p" : "h2";
  const role = variant === "page" ? undefined : descriptor.live;

  return (
    <section className={`${styles.root} ${styles[variant]} ${styles[`tone_${descriptor.tone}`]}`} role={role} aria-live={variant === "page" ? undefined : descriptor.live === "alert" ? "assertive" : "polite"} data-error-kind={descriptor.kind}>
      <div className={styles.visual} aria-hidden="true">
        {variant === "page" && descriptor.hero ? <span className={styles.hero}>{descriptor.hero}</span> : null}
        <span className={`${styles.halo} ${styles[`motion_${descriptor.motion}`]}`}>
          <ErrorIcon name={descriptor.icon} size={variant === "page" ? 44 : variant === "section" ? 34 : 22} />
        </span>
      </div>
      <div className={styles.body}>
        <HeadingTag ref={titleRef as never} className={styles.title} tabIndex={shouldFocus ? -1 : undefined}>
          {title}
        </HeadingTag>
        {reconnected ? null : <p className={styles.description}>{description}</p>}
        {children}
        {reconnected ? (
          <p className={styles.reconnected} role="status">
            You&apos;re back online. Reloading…
          </p>
        ) : null}
        {!hideActions && (primary || action || showSecondary) ? (
          <div className={styles.actions}>
            {primary ? <ErrorActionButton action={primary} emphasis="primary" /> : null}
            {showSecondary && secondary ? <ErrorActionButton action={secondary} emphasis="secondary" /> : null}
            {action}
          </div>
        ) : null}
        {variant !== "inline" ? <ErrorReference code={descriptor.code} reference={descriptor.reference} /> : null}
      </div>
    </section>
  );
}

export function ErrorScreen(props: Omit<ErrorStateProps, "variant">) {
  return <ErrorState {...props} variant="page" />;
}
