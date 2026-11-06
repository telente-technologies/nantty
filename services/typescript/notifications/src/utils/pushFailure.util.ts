const safeProviderCodes = new Set([
  "DeviceNotRegistered", "MessageRateExceeded", "MessageTooBig", "InvalidCredentials", "MismatchSenderId",
  "ExpoPushServerError", "ServiceUnavailable", "TooManyRequests", "PUSH_TOO_MANY_NOTIFICATIONS",
  "PUSH_TOO_MANY_EXPERIENCE_IDS", "PUSH_TOO_MANY_RECEIPTS", "PUSH_TOO_MANY_REQUESTS", "PUSH_INVALID_CREDENTIALS",
  "NETWORK_ERROR", "INVALID_TICKET_RESPONSE", "INVALID_TICKET", "UNKNOWN_TICKET_ERROR", "UNKNOWN_PROVIDER_ERROR",
  "PROVIDER_DISABLED", "FCM_AUTH_UNAVAILABLE", "UNREGISTERED", "RESOURCE_EXHAUSTED", "UNAVAILABLE", "INTERNAL",
  "PERMISSION_DENIED", "UNAUTHENTICATED", "INVALID_ARGUMENT", "TOKEN_PRUNE_FAILED",
]);

export function normalizePushProviderCode(code: string): string {
  return safeProviderCodes.has(code) || /^HTTP_[45]\d{2}$/.test(code) ? code : "UNKNOWN_PROVIDER_ERROR";
}

export function sanitizePushFailureReason(reason: string | null): string | null {
  if (reason === null) return null;
  if (reason === "push_transport_error:retryable" || reason === "widget_push_transport_error:retryable") return reason;
  if (/^(expo|fcm)_push_transport_error:retryable$/.test(reason) || /^(expo|fcm)_widget_push_transport_error:retryable$/.test(reason)) return reason;

  const expo = /^expo_push_failure:accepted=(\d{1,6});(.{1,160})$/.exec(reason);
  if (expo !== null && sanitizeGroupedCodes(expo[2]!, true)) return reason;

  const widget = /^widget_push_failure:(.{1,160})$/.exec(reason);
  if (widget !== null && sanitizeGroupedCodes(widget[1]!, false)) return reason;

  const providerFailure = /^push_provider_failure:(.{1,160})$/.exec(reason);
  if (providerFailure !== null && sanitizeProviderGroupedCodes(providerFailure[1]!)) return reason;

  const widgetProviderFailure = /^widget_push_provider_failure:(.{1,160})$/.exec(reason);
  if (widgetProviderFailure !== null && sanitizeProviderWidgetCodes(widgetProviderFailure[1]!)) return reason;

  // Older push rows stored raw provider exception messages, which could include tokens.
  return "legacy_provider_failure";
}

function sanitizeProviderGroupedCodes(value: string): boolean {
  const entries = value.split(",");
  if (entries.length < 1 || entries.length > 13) return false;
  return entries.every((entry) => {
    const match = /^(expo|fcm):(retryable|permanent):([A-Za-z0-9_-]{1,64}):\d{1,6}$/.exec(entry);
    return match !== null && normalizePushProviderCode(match[3]!) === match[3];
  });
}

function sanitizeProviderWidgetCodes(value: string): boolean {
  const entries = value.split(",");
  if (entries.length < 1 || entries.length > 13) return false;
  return entries.every((entry) => {
    const match = /^(expo|fcm):(retryable|permanent):([A-Za-z0-9_-]{1,64})$/.exec(entry);
    return match !== null && normalizePushProviderCode(match[3]!) === match[3];
  });
}

function sanitizeGroupedCodes(value: string, includeCounts: boolean): boolean {
  const entries = value.split(",");
  if (entries.length < 1 || entries.length > 13) return false;
  let pruneFailureSeen = false;
  for (const entry of entries) {
    if (includeCounts && /^token_prune_failed:\d{1,6}$/.test(entry)) {
      if (pruneFailureSeen) return false;
      pruneFailureSeen = true;
      continue;
    }
    const match = includeCounts
      ? /^(retryable|permanent):([A-Za-z0-9_-]{1,64}):(\d{1,6})$/.exec(entry)
      : /^(retryable|permanent):([A-Za-z0-9_-]{1,64})$/.exec(entry);
    if (match === null || normalizePushProviderCode(match[2]!) !== match[2]) return false;
  }
  return true;
}
