export interface HostedCheckoutSession {
  readonly checkoutUrl?: string | null;
  readonly authorizationUrl?: string | null;
  readonly reference: string;
}

export type HostedCheckoutOutcome = "redirected" | "blocked";

export const defaultHostedCheckoutHosts: readonly string[] = ["checkout.flutterwave.com", "checkout-testing.flutterwave.com"];

export function readHostedCheckoutUrl(session: HostedCheckoutSession, allowedHosts: readonly string[] = defaultHostedCheckoutHosts): string | null {
  const candidate = (session.checkoutUrl || session.authorizationUrl || "").trim();
  if (!candidate) return null;
  if (candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\")) return candidate;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return allowedHosts.includes(url.hostname.toLowerCase()) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function openHostedCheckout(session: HostedCheckoutSession, allowedHosts?: readonly string[]): HostedCheckoutOutcome {
  const url = readHostedCheckoutUrl(session, allowedHosts);
  if (!url) return "blocked";
  window.location.assign(url);
  return "redirected";
}
