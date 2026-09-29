const allowedHostedCheckoutHosts = ["checkout.paystack.com", "checkout.flutterwave.com"];

export function isAuthorizationUrlSafeToOpen(authorizationUrl: string): boolean {
  if (authorizationUrl.startsWith("/accounts/") && !authorizationUrl.startsWith("//") && !authorizationUrl.includes("\\")) return true;
  try {
    const url = new URL(authorizationUrl);
    return url.protocol === "https:" && !url.username && !url.password && allowedHostedCheckoutHosts.includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function openHostedCheckoutIfSafe(authorizationUrl: string): boolean {
  if (!isAuthorizationUrlSafeToOpen(authorizationUrl)) return false;
  window.location.assign(authorizationUrl);
  return true;
}
