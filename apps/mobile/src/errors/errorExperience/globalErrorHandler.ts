import { useAppGateStore } from "@/store/appGate.store";
import { useAuthStore } from "@/store/auth.store";
import { showToast } from "@/store/toast.store";

import { resolveErrorKind } from "./errorMapper";
import { readErrorSignal } from "./errorSignal";

const SESSION_TOAST_COOLDOWN_MS = 10_000;
const nonRetryableStatuses = new Set([400, 401, 403, 404, 409, 410, 413, 415, 422, 426]);
let lastSessionToastAt = 0;

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const { status } = readErrorSignal(error);
  if (status !== undefined && nonRetryableStatuses.has(status)) return false;
  return failureCount < 1;
}

export function handleGlobalApiError(error: unknown, now = Date.now()): void {
  const { kind } = resolveErrorKind(readErrorSignal(error));
  if (kind === "updateRequired") {
    useAppGateStore.getState().markUpdateRequired();
    return;
  }
  if (kind === "sessionExpired" && useAuthStore.getState().status === "signedIn" && now - lastSessionToastAt > SESSION_TOAST_COOLDOWN_MS) {
    lastSessionToastAt = now;
    showToast("Your session has ended. Sign in again to carry on.");
  }
}
