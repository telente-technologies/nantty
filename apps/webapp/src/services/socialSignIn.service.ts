import type { User } from "@/types";

import { sendRequestToWebappServer } from "./clientApi.service";

export type SocialSignInProvider = "apple" | "google";

export type SocialSignInIdentity =
  | { readonly idToken: string; readonly nonce: string }
  | { readonly identityToken: string; readonly nonce: string; readonly fullName?: { readonly givenName: string | null; readonly familyName: string | null } | null };

export async function signInWithSocialProvider(provider: SocialSignInProvider, identity?: SocialSignInIdentity, birthday?: string): Promise<{ readonly user: User; readonly notice?: string | null }> {
  return sendRequestToWebappServer<{ user: User; notice?: string | null }>("/auth/social", {
    method: "POST",
    body: {
      provider,
      ...(identity && "idToken" in identity ? { idToken: identity.idToken, nonce: identity.nonce } : {}),
      ...(identity && "identityToken" in identity ? { identityToken: identity.identityToken, nonce: identity.nonce, fullName: identity.fullName } : {}),
      ...(birthday ? { birthday } : {}),
    },
  });
}

export function createSocialSignInNonce(): string {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashSocialSignInNonce(nonce: string): Promise<string> {
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readNonceFromIdentityToken(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const binary = window.atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { nonce?: unknown };
    return typeof claims.nonce === "string" ? claims.nonce : null;
  } catch {
    return null;
  }
}
