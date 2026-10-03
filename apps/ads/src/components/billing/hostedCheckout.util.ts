import { openPaystackCheckout } from "@/utils/paystackCheckout.util";

const allowedHostedCheckoutHosts = ["checkout.paystack.com"];

export function isAuthorizationUrlSafeToOpen(authorizationUrl: string): boolean {
  if (authorizationUrl.startsWith("/accounts/") && !authorizationUrl.startsWith("//") && !authorizationUrl.includes("\\")) return true;
  try {
    const url = new URL(authorizationUrl);
    return url.protocol === "https:" && !url.username && !url.password && allowedHostedCheckoutHosts.includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export async function openPaystackCheckoutIfSafe(checkout: { authorizationUrl: string; accessCode: string; reference: string }, completedHref: string): Promise<boolean> {
  if (!isAuthorizationUrlSafeToOpen(checkout.authorizationUrl)) return false;
  const outcome = await openPaystackCheckout(checkout);
  if (outcome === "completed") window.location.assign(completedHref);
  return true;
}
