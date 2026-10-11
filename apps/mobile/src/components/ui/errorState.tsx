import NetInfo from "@react-native-community/netinfo";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useAccessibilityFocusOnOpen } from "@/components/ui/accessibilityFocus.hook";
import { resolveErrorAction, type ErrorAction, type ErrorActionHandlers } from "@/errors/errorExperience/errorActions";
import { describeError, genericErrorKinds } from "@/errors/errorExperience/describeError";
import type { ErrorKind, ErrorSubject } from "@/errors/errorExperience/errorKinds";
import { formatCountdownClock } from "@/errors/errorExperience/retryCountdown";
import { useRetryCountdown } from "@/errors/errorExperience/useRetryCountdown";
import { isDeviceConnectedAccordingToNetInfo, useOfflineStore } from "@/store/offline.store";
import { makeThemedStyles, useTheme } from "@/theme";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

import { Button } from "./button";
import { ErrorHalo } from "./errorHalo";
import { ErrorReference } from "./errorReference";
import { Text } from "./text";

export type ErrorStateVariant = "page" | "section" | "inline" | "compact";

export interface ErrorStateProps {
  readonly error?: unknown;
  readonly kind?: ErrorKind;
  readonly subject?: ErrorSubject;
  readonly variant?: ErrorStateVariant;
  readonly title?: string;
  readonly description?: string;
  readonly message?: string;
  readonly detail?: string;
  readonly onRetry?: () => void;
  readonly retrying?: boolean;
  readonly retryLabel?: string;
  readonly compact?: boolean;
  readonly handlers?: ErrorActionHandlers;
  readonly primaryAction?: ErrorAction;
  readonly secondaryAction?: ErrorAction;
  readonly hideActions?: boolean;
  readonly reference?: string;
  readonly code?: string;
  readonly children?: ReactNode;
}

const haloSizeByVariant: Readonly<Record<ErrorStateVariant, number>> = { page: 92, section: 72, compact: 56, inline: 36 };

function useReconnectRetry(isOffline: boolean, onRetry: (() => void) | undefined): boolean {
  const isOnline = useOfflineStore((state) => state.isOnline);
  const wasOfflineRef = useRef(!isOnline);
  const [reconnected, setReconnected] = useState(false);
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }
    if (!wasOfflineRef.current) return;
    wasOfflineRef.current = false;
    if (!isOffline) return;
    setReconnected(true);
    onRetry?.();
  }, [isOnline, isOffline, onRetry]);
  return reconnected;
}

export function ErrorState(props: ErrorStateProps) {
  const { onRetry, retrying = false, hideActions, children } = props;
  const variant: ErrorStateVariant = props.variant ?? (props.compact ? "section" : "page");
  const { colors } = useTheme();
  const styles = useStyles();
  const isOnline = useOfflineStore((state) => state.isOnline);
  const descriptor = describeError({ error: props.error, kind: props.kind, subject: props.subject, reference: props.reference, code: props.code, isOnline });
  const useCallerCopy = props.kind !== undefined || genericErrorKinds.has(descriptor.kind);
  const title = (useCallerCopy ? (props.title ?? props.message) : undefined) ?? descriptor.title;
  const description = (useCallerCopy ? (props.description ?? props.detail) : undefined) ?? descriptor.description;
  const secondsLeft = useRetryCountdown(descriptor.retryAfterSeconds);
  const reconnected = useReconnectRetry(descriptor.kind === "offline", onRetry);
  const [checking, setChecking] = useState(false);
  const titleRef = useAccessibilityFocusOnOpen(variant === "page");

  const checkAgain = onRetry
    ? () => {
        setChecking(true);
        NetInfo.refresh()
          .then((state) => {
            if (isDeviceConnectedAccordingToNetInfo(state)) onRetry();
          })
          .catch(() => undefined)
          .finally(() => setChecking(false));
      }
    : undefined;
  const sources = { onRetry: descriptor.kind === "offline" ? checkAgain : onRetry, retryLabel: props.retryLabel, handlers: props.handlers };
  let primary = props.primaryAction ?? resolveErrorAction(descriptor.primary, sources) ?? resolveErrorAction("retry", sources);
  const secondary = props.secondaryAction ?? (variant === "page" ? resolveErrorAction(descriptor.secondary, sources) : null);
  if (primary && descriptor.kind === "rateLimited" && secondsLeft > 0) primary = { ...primary, label: `Try again in ${formatCountdownClock(secondsLeft)}`, disabled: true };
  const showSecondary = secondary && secondary.label !== primary?.label && variant !== "inline";
  const isInline = variant === "inline";

  return (
    <View
      accessibilityRole={descriptor.live === "alert" ? "alert" : "summary"}
      accessibilityLiveRegion={descriptor.live === "alert" ? "assertive" : "polite"}
      testID={`error-state-${descriptor.kind}`}
      style={[styles.root, styles[variant], variant === "compact" ? { backgroundColor: colors.surface, borderColor: colors.divider } : null, isInline ? { backgroundColor: colors.sunken } : null]}
    >
      <View style={styles.visual}>
        {variant === "page" && descriptor.hero ? (
          <Text size={128} weight={900} lineHeight={136} color={colors.primary} style={styles.hero} importantForAccessibility="no" accessibilityElementsHidden>
            {descriptor.hero}
          </Text>
        ) : null}
        <ErrorHalo icon={descriptor.icon} tone={descriptor.tone} motion={descriptor.motion} size={haloSizeByVariant[variant]} animated={!isInline} />
      </View>
      <View style={[styles.copy, isInline ? styles.inlineCopy : null]}>
        <View ref={titleRef} accessible accessibilityRole="header">
          <Text size={variant === "page" ? typeScale.lg : typeScale.base} weight={700} lineHeight={variant === "page" ? 26 : 21} align={isInline ? "left" : "center"}>
            {title}
          </Text>
        </View>
        {reconnected ? null : (
          <Text size={typeScale.md} lineHeight={20} align={isInline ? "left" : "center"} color={colors.textMuted}>
            {description}
          </Text>
        )}
        {children}
        {reconnected ? (
          <Text size={typeScale.md} weight={600} align="center" color={colors.successText} accessibilityLiveRegion="polite">
            You&apos;re back online. Reloading…
          </Text>
        ) : null}
        {!hideActions && (primary || showSecondary) ? (
          <View style={[styles.actions, isInline ? styles.inlineActions : null]}>
            {primary ? <Button title={checking ? "Checking…" : primary.label} onPress={primary.onPress} disabled={primary.disabled} loading={retrying || checking} height={isInline ? 34 : 44} style={styles.button} /> : null}
            {showSecondary && secondary ? <Button title={secondary.label} variant="outline" onPress={secondary.onPress} disabled={secondary.disabled} style={styles.button} /> : null}
          </View>
        ) : null}
        {!isInline ? <ErrorReference code={descriptor.code} reference={descriptor.reference} /> : null}
      </View>
    </View>
  );
}

export function ErrorScreen(props: Omit<ErrorStateProps, "variant" | "compact">) {
  return <ErrorState {...props} variant="page" />;
}

const useStyles = makeThemedStyles(() => StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center", gap: spacing[5], paddingHorizontal: spacing[6], alignSelf: "stretch" },
  page: { flex: 1, minHeight: 420, paddingVertical: spacing[9] },
  section: { minHeight: 260, paddingVertical: spacing[7] },
  compact: { alignSelf: "center", width: "100%", maxWidth: 480, paddingVertical: spacing[6], gap: spacing[3], borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginVertical: spacing[3] },
  inline: { flexDirection: "row", gap: spacing[3], paddingVertical: spacing[3], paddingHorizontal: spacing[4], borderRadius: 12, marginVertical: spacing[2] },
  visual: { alignItems: "center", justifyContent: "center" },
  hero: { position: "absolute", opacity: 0.12, letterSpacing: -6 },
  copy: { alignItems: "center", gap: spacing[2], maxWidth: 440, width: "100%" },
  inlineCopy: { alignItems: "flex-start", flex: 1, maxWidth: undefined },
  actions: { alignSelf: "stretch", alignItems: "center", gap: spacing[3], marginTop: spacing[3] },
  inlineActions: { alignItems: "flex-start", marginTop: spacing[1] },
  button: { minWidth: 200, paddingHorizontal: spacing[5] },
}));
