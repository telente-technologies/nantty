import { defaultHostedCheckoutHosts, openHostedCheckout, readHostedCheckoutUrl } from "@/utils/hostedCheckout.util";

const configuredCheckoutHosts = (process.env.NEXT_PUBLIC_ADS_CHECKOUT_HOSTS ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
const allowedHostedCheckoutHosts = configuredCheckoutHosts.length > 0 ? configuredCheckoutHosts : defaultHostedCheckoutHosts;

export function isAuthorizationUrlSafeToOpen(authorizationUrl: string): boolean {
  if (authorizationUrl.startsWith("/") && !authorizationUrl.startsWith("/accounts/")) return false;
  return readHostedCheckoutUrl({ checkoutUrl: authorizationUrl, reference: "" }, allowedHostedCheckoutHosts) !== null;
}

export function openHostedCheckoutIfSafe(checkout: { readonly checkoutUrl?: string | null; readonly authorizationUrl: string; readonly reference: string }): boolean {
  const url = checkout.checkoutUrl || checkout.authorizationUrl;
  if (!isAuthorizationUrlSafeToOpen(url)) return false;
  return openHostedCheckout({ checkoutUrl: url, reference: checkout.reference }, allowedHostedCheckoutHosts) === "redirected";
}
