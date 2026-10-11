const messagesByErrorCode: Record<string, string> = {
  FORBIDDEN: "Your role does not include this permission. Ask a superadmin to grant it.",
  STEP_UP_REQUIRED: "Confirm it's you with your authenticator code to continue.",
  STEP_UP_CANCELLED: "Action cancelled. Nothing was changed.",
  REASON_REQUIRED: "Add a reason of at least 5 characters. It is saved in the audit log.",
  CSRF_REJECTED: "This request could not be verified. Reload the page and try again.",
  IP_NOT_ALLOWED: "This network is not on the admin allow-list.",
  SESSION_PRIVILEGES_CHANGED: "Your admin access changed. Sign in again to continue.",
  NOT_FOUND: "That record no longer exists or the link is wrong.",
  CONFLICT: "Someone else changed this first. Reload to see the latest version, then try again.",
  VERSION_CONFLICT: "Someone else changed this first. Reload to see the latest version, then try again.",
  IDEMPOTENCY_KEY_REUSED: "This action was already submitted. Reload to see its result.",
  RATE_LIMITED: "Too many attempts. Wait a minute, then try again.",
  PAYLOAD_TOO_LARGE: "That request is too large.",
  VALIDATION_FAILED: "Some fields need fixing. Check the highlighted fields.",
  UNAVAILABLE: "That service is not responding. Nothing was changed. Try again in a minute.",
  NETWORK_UNAVAILABLE: "You appear to be offline. Nothing was sent.",
};

export function describeHttpStatus(status: number): string {
  if (status === 0) return messagesByErrorCode.NETWORK_UNAVAILABLE!;
  if (status === 400 || status === 422) return messagesByErrorCode.VALIDATION_FAILED!;
  if (status === 403) return messagesByErrorCode.FORBIDDEN!;
  if (status === 404) return messagesByErrorCode.NOT_FOUND!;
  if (status === 409) return messagesByErrorCode.CONFLICT!;
  if (status === 429) return messagesByErrorCode.RATE_LIMITED!;
  if (status >= 500) return `The server failed (HTTP ${status}). Nothing was changed. Try again, and report it if it repeats.`;
  return `The request failed (HTTP ${status}).`;
}

export function resolveAdminErrorMessage(code: string, backendMessage: string | undefined, status: number): string {
  const message = backendMessage?.trim() || messagesByErrorCode[code] || describeHttpStatus(status);
  return `${message} (${code})`;
}
