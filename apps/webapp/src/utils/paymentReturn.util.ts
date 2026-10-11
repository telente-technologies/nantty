export const pendingSubscriptionStorageKey = "zd_pending_subscription";
export const pendingOrderPaymentStorageKey = "zd_pending_payment";

export function paymentReturnUrl(): string {
  return `${window.location.origin}/pay/return`;
}

export function readPendingValue(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function rememberPendingValue(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    return;
  }
}

export function forgetPendingValue(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    return;
  }
}

export interface PendingOrderPayment {
  readonly orderId: string;
  readonly reference: string;
  readonly checkoutUrl: string;
  readonly startedAt: number;
}

const pendingOrderPaymentLifetimeMs = 24 * 60 * 60 * 1000;

export function rememberPendingOrderPayment(payment: Omit<PendingOrderPayment, "startedAt">): void {
  try {
    window.localStorage.setItem(pendingOrderPaymentStorageKey, JSON.stringify({ ...payment, startedAt: Date.now() }));
  } catch {
    return;
  }
}

export function readPendingOrderPayment(orderId?: string): PendingOrderPayment | null {
  try {
    const raw = window.localStorage.getItem(pendingOrderPaymentStorageKey) ?? window.sessionStorage.getItem(pendingOrderPaymentStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingOrderPayment> & { readonly authorizationUrl?: string };
    if (typeof parsed.orderId !== "string" || typeof parsed.reference !== "string") return null;
    if (orderId && parsed.orderId !== orderId) return null;
    const startedAt = typeof parsed.startedAt === "number" ? parsed.startedAt : Date.now();
    if (Date.now() - startedAt > pendingOrderPaymentLifetimeMs) return null;
    return { orderId: parsed.orderId, reference: parsed.reference, checkoutUrl: parsed.checkoutUrl ?? parsed.authorizationUrl ?? "", startedAt };
  } catch {
    return null;
  }
}

export function forgetPendingOrderPayment(): void {
  try {
    window.localStorage.removeItem(pendingOrderPaymentStorageKey);
    window.sessionStorage.removeItem(pendingOrderPaymentStorageKey);
  } catch {
    return;
  }
}
