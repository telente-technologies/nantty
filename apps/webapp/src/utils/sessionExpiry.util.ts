import { isGuestBrowsablePage } from "@/config/guestBrowsing.config";

export type SessionExpiredAction = { readonly kind: "prompt" } | { readonly kind: "redirect"; readonly href: string };

// When the BFF reports SESSION_EXPIRED: pages a guest may browse keep working anonymously and only offer sign-in;
// member-only pages go to sign-in and come back afterwards.
export function decideSessionExpiredAction(pathname: string, search = ""): SessionExpiredAction {
  if (pathname === "/login" || pathname.startsWith("/login/") || isGuestBrowsablePage(pathname)) return { kind: "prompt" };
  return { kind: "redirect", href: `/login?next=${encodeURIComponent(`${pathname}${search}`)}` };
}
