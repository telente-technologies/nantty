export interface HostedCheckoutSession {
  readonly checkoutUrl?: string | null;
  readonly authorizationUrl?: string | null;
  readonly reference: string;
}

export type HostedCheckoutOutcome = "redirected" | "blocked";

export const hostedCheckoutHosts: readonly string[] = ["checkout.flutterwave.com", "checkout-testing.flutterwave.com"];

export function readHostedCheckoutUrl(session: HostedCheckoutSession, origin: string): string | null {
  const raw = session.checkoutUrl || session.authorizationUrl || "";
  if (!raw) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw, origin);
    if (url.origin === origin) return url.toString();
    return url.protocol === "https:" && hostedCheckoutHosts.includes(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function openHostedCheckout(session: HostedCheckoutSession): HostedCheckoutOutcome {
  const url = readHostedCheckoutUrl(session, window.location.origin);
  if (!url) return "blocked";
  window.location.assign(url);
  return "redirected";
}
