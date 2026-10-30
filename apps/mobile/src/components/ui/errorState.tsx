import NetInfo from "@react-native-community/netinfo";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

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
  const { width, fontScale } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(width);
  const availableWidth = Math.min(width, containerWidth);
  const pageTitleSize = Math.max(28, Math.min(40, availableWidth * 0.075));
  const heroSize = Math.max(112, Math.min(192, availableWidth * 0.4));
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
  const stackInline = isInline && (availableWidth < 480 || fontScale > 1.2);

  return (
    <View
      accessibilityRole={descriptor.live === "alert" ? "alert" : "summary"}
      accessibilityLiveRegion={descriptor.live === "alert" ? "assertive" : "polite"}
      testID={`error-state-${descriptor.kind}`}
      onLayout={({ nativeEvent }) => setContainerWidth(nativeEvent.layout.width)}
      style={[styles.root, styles[variant], stackInline ? styles.stackedInline : null, variant === "compact" ? { backgroundColor: colors.surface, borderColor: colors.divider } : null, isInline ? { backgroundColor: colors.sunken } : null]}
    >
      <View style={styles.visual}>
        {variant === "page" && descriptor.hero ? (
          <Text size={heroSize} weight={900} lineHeight={heroSize * 1.05} color={colors.primary} style={styles.hero} allowFontScaling={false} importantForAccessibility="no" accessibilityElementsHidden>
            {descriptor.hero}
          </Text>
        ) : null}
        <ErrorHalo icon={descriptor.icon} tone={descriptor.tone} motion={descriptor.motion} size={haloSizeByVariant[variant]} animated={!isInline} />
      </View>
      <View style={[styles.copy, isInline ? styles.inlineCopy : null, stackInline ? styles.stackedCopy : null]}>
        <View ref={titleRef} accessible accessibilityRole="header">
          <Text size={variant === "page" ? pageTitleSize : typeScale.base} weight={700} lineHeight={variant === "page" ? Math.ceil(pageTitleSize * 1.12) : 21} letterSpacing={variant === "page" ? -pageTitleSize * 0.045 : undefined} align={isInline ? "left" : "center"}>
            {title}
          </Text>
        </View>
        {reconnected ? null : (
          <Text size={typeScale.md} lineHeight={23} align={isInline ? "left" : "center"} color={colors.textMuted}>
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
            {primary ? <RecoveryAction action={checking ? { ...primary, label: "Checking…" } : primary} loading={retrying || checking} /> : null}
            {showSecondary && secondary ? <RecoveryAction action={secondary} secondary /> : null}
          </View>
        ) : null}
        {!isInline ? <ErrorReference code={descriptor.code} reference={descriptor.reference} /> : null}
      </View>
    </View>
  );
}

function RecoveryAction({ action, secondary = false, loading = false }: { readonly action: ErrorAction; readonly secondary?: boolean; readonly loading?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const disabled = action.disabled || loading;
  const ink = secondary ? colors.text : colors.onPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: Boolean(disabled), busy: loading }}
      disabled={disabled}
      onPress={action.onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: secondary ? colors.surface : colors.primarySolid, borderColor: secondary ? colors.divider : colors.primarySolid, opacity: disabled ? 0.6 : pressed ? 0.85 : 1 }]}
    >
      {loading ? <ActivityIndicator color={ink} /> : <Text size={15} weight={600} lineHeight={22} color={ink} align="center" style={styles.actionText}>{action.label}</Text>}
    </Pressable>
  );
}

export function ErrorScreen(props: Omit<ErrorStateProps, "variant" | "compact">) {
  return <ErrorState {...props} variant="page" />;
}

const useStyles = makeThemedStyles(() => StyleSheet.create({
  root: { minWidth: 0, alignItems: "center", justifyContent: "center", gap: spacing[5], paddingHorizontal: spacing[6], alignSelf: "stretch" },
  page: { flexGrow: 1, minHeight: 420, paddingVertical: spacing[9], gap: spacing[8] },
  section: { minHeight: 260, paddingVertical: spacing[7] },
  compact: { alignSelf: "center", width: "100%", maxWidth: 480, paddingVertical: spacing[6], gap: spacing[3], borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginVertical: spacing[3] },
  inline: { flexDirection: "row", gap: spacing[3], paddingVertical: spacing[3], paddingHorizontal: spacing[4], borderRadius: 12, marginVertical: spacing[2] },
  visual: { alignItems: "center", justifyContent: "center" },
  hero: { position: "absolute", opacity: 0.12, letterSpacing: -6 },
  copy: { minWidth: 0, alignItems: "center", gap: spacing[4], maxWidth: 560, width: "100%" },
  inlineCopy: { alignItems: "flex-start", flex: 1, width: undefined, maxWidth: undefined, gap: spacing[2] },
  stackedInline: { flexDirection: "column", alignItems: "flex-start" },
  stackedCopy: { flex: 0, width: "100%" },
  actions: { alignSelf: "stretch", alignItems: "center", gap: spacing[3], marginTop: spacing[3] },
  inlineActions: { alignItems: "flex-start", marginTop: spacing[1] },
  button: { minWidth: 0, maxWidth: "100%", width: "100%", minHeight: 44, paddingHorizontal: spacing[4], paddingVertical: spacing[3], alignItems: "center", justifyContent: "center", borderRadius: 999, borderWidth: 1 },
  actionText: { flexShrink: 1 },
}));
