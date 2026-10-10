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
